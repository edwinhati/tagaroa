#!/bin/sh
# Usage: deploy.sh < release | deploy.sh --rollback
# Runs in /home/tagaroa/apps on the dev droplet or the OCI VM, beside that server's
# compose.yml (compose.dev.yml or compose.prod.yml here). The release is one KEY=value
# per line: RELEASE_SHA, CORE_IMAGE, AUTH_IMAGE, ADMIN_IMAGE, WORKSPACE_IMAGE and
# ENGINEERING_IMAGE (development.yml writes dev's, scripts/ci/release.sh prod's).
# On a failed pull, migrate, preflight or start the previous images are brought back
# (schema changes are additive by policy, docs/security/access-control-rollout.md
# "Rollback") and the exit is non-zero. --rollback brings back the release before the
# current one; the workflows run it when the checks fail after a deploy that succeeded.
# The servers differ only in what sits beside this script: prod has `.ocir`, its OCIR
# login as shell assignments, and dev's compose.yml runs its own `postgres`.
set -eu
cd "$(dirname "$0")"
test -f .env
umask 077
# Word splitting of $services is intended below: one argument per service.
services="core auth admin workspace engineering"
release_file=.release.env.pending
compose() { docker compose --env-file .env --env-file "$release_file" -f compose.yml "$@"; }
trap 'rm -f .release.env.pending' EXIT

rollback() {
  if [ ! -f .release.env.previous ]; then
    # shellcheck disable=SC2086
    if [ -f .release.env ]; then release_file=.release.env; compose stop $services; rm -f .release.env; fi
    echo 'No previous release exists; the first release is stopped.'
    return 0
  fi
  cp .release.env.previous .release.env
  release_file=.release.env
  # shellcheck disable=SC2086
  compose up -d --wait --wait-timeout 240 $services
}
if [ "${1:-}" = --rollback ]; then rollback; exit; fi
[ $# -eq 0 ] || { echo 'usage: deploy.sh < release | deploy.sh --rollback' >&2; exit 2; }

# Compose reads the release as env, so it holds those six keys once each and nothing else.
cat > .release.env.pending
if grep -vqE '^(RELEASE_SHA=[0-9a-f]{40}|[A-Z]+_IMAGE=[A-Za-z0-9._/:@-]+)$' .release.env.pending \
  || [ "$(wc -l < .release.env.pending)" -ne 6 ]; then
  echo "deploy.sh: the release must be six KEY=value lines" >&2; exit 2
fi
for key in RELEASE_SHA CORE_IMAGE AUTH_IMAGE ADMIN_IMAGE WORKSPACE_IMAGE ENGINEERING_IMAGE; do
  grep -q "^$key=" .release.env.pending || { echo "deploy.sh: $key is missing" >&2; exit 2; }
done

if [ -f .ocir ]; then
  set -a
  # shellcheck source=/dev/null
  . ./.ocir
  set +a
  printf '%s' "$OCIR_TOKEN" | docker login sin.ocir.io --username "$OCIR_USERNAME" --password-stdin
fi

# The "DEPLOY FAILED" line names the failing step in the run log.
failed() {
  echo "DEPLOY FAILED at step: $1" >&2
  if [ -f .release.env ]; then
    release_file=.release.env
    # shellcheck disable=SC2086
    compose up -d --wait --wait-timeout 240 $services \
      || { echo 'ROLLBACK FAILED: previous images did not come back healthy' >&2; exit 2; }
  else
    # shellcheck disable=SC2086
    compose stop $services || { echo 'ROLLBACK FAILED: could not stop the first release' >&2; exit 2; }
    echo 'No previous release to restore; the stack is stopped.' >&2
  fi
  exit 1
}

compose pull || failed pull
if compose config --services | grep -qx postgres; then compose up -d --wait postgres || failed postgres; fi
compose run --rm --no-deps migrate || failed migrate
compose run --rm --no-deps preflight || failed preflight
# shellcheck disable=SC2086
compose up -d --wait --wait-timeout 240 --remove-orphans $services || failed start
if [ -f .release.env ] && ! cmp -s .release.env .release.env.pending; then cp .release.env .release.env.previous; fi
mv .release.env.pending .release.env
echo "Deployed $(sed -n 's/^RELEASE_SHA=//p' .release.env)"
