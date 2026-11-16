#!/bin/sh
# Usage: deploy.sh < release | deploy.sh --rollback
# The release is one KEY=value per line: RELEASE_SHA, CORE_IMAGE, AUTH_IMAGE,
# ADMIN_IMAGE, WORKSPACE_IMAGE and ENGINEERING_IMAGE (development.yml writes it).
# Runs on the dev droplet in /home/tagaroa/apps. On a failed migrate, preflight or start
# the previous images are brought back (schema changes are additive by policy,
# docs/security/access-control-rollout.md "Rollback") and the exit is non-zero.
# --rollback brings back the release before the current one, as prod's does; the
# workflow runs it when the smoke check fails after a deploy that succeeded.
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
  [ -f .release.env.previous ] || { echo 'No previous release to restore.' >&2; exit 1; }
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

# The "DEPLOY FAILED" line names the failing step in the run log.
failed() {
  echo "DEPLOY FAILED at step: $1" >&2
  if [ -f .release.env ]; then
    release_file=.release.env
    # shellcheck disable=SC2086
    compose up -d --wait --wait-timeout 240 $services \
      || echo "ROLLBACK FAILED: previous images did not come back healthy" >&2
  else
    # shellcheck disable=SC2086
    compose stop $services || true
    echo "No previous release to restore." >&2
  fi
  exit 1
}

compose pull || failed pull
compose up -d --wait postgres || failed postgres
compose run --rm --no-deps migrate || failed migrate
compose run --rm --no-deps preflight || failed preflight
# shellcheck disable=SC2086
compose up -d --wait --wait-timeout 240 --remove-orphans $services || failed start
if [ -f .release.env ] && ! cmp -s .release.env .release.env.pending; then cp .release.env .release.env.previous; fi
mv .release.env.pending .release.env
echo "Deployed $(sed -n 's/^RELEASE_SHA=//p' .release.env)"
