#!/bin/sh
# Usage: deploy.sh < release | deploy.sh --rollback
# The release is one KEY=value per line: RELEASE_SHA, CORE_IMAGE, AUTH_IMAGE,
# ADMIN_IMAGE, WORKSPACE_IMAGE and ENGINEERING_IMAGE (infra/release/release.sh writes it).
# Runs on the OCI VM in /home/tagaroa/apps.
set -eu
cd "$(dirname "$0")"
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
    echo 'No previous release exists; first-release services stopped.'
    return 0
  fi
  cp .release.env.previous .release.env
  release_file=.release.env
  # shellcheck disable=SC2086
  compose up -d --wait --wait-timeout 240 $services
}
if [ "${1:-}" = --rollback ]; then rollback; exit; fi
[ $# -eq 0 ] || { echo 'usage: deploy.sh < release | deploy.sh --rollback' >&2; exit 2; }
test -f .env
test -f .ocir
# Compose reads the release as env, so it holds those six keys once each and nothing else.
cat > .release.env.pending
if grep -vqE '^(RELEASE_SHA=[0-9a-f]{40}|[A-Z]+_IMAGE=[A-Za-z0-9._/:@-]+)$' .release.env.pending \
  || [ "$(wc -l < .release.env.pending)" -ne 6 ]; then
  echo "deploy.sh: the release must be six KEY=value lines" >&2; exit 2
fi
for key in RELEASE_SHA CORE_IMAGE AUTH_IMAGE ADMIN_IMAGE WORKSPACE_IMAGE ENGINEERING_IMAGE; do
  grep -q "^$key=" .release.env.pending || { echo "deploy.sh: $key is missing" >&2; exit 2; }
done
set -a
# shellcheck source=/dev/null
. ./.ocir
set +a
printf '%s' "$OCIR_TOKEN" | docker login sin.ocir.io --username "$OCIR_USERNAME" --password-stdin
failed() {
  echo "Deployment failed at $1" >&2
  if [ -f .release.env ]; then
    release_file=.release.env
    # shellcheck disable=SC2086
    compose up -d --wait --wait-timeout 240 $services || { echo 'ROLLBACK FAILED' >&2; exit 2; }
  else
    # shellcheck disable=SC2086
    compose stop $services || { echo 'ROLLBACK FAILED' >&2; exit 2; }
    rm -f .release.env
    echo 'First release failed; no previous deployment exists.' >&2
  fi
  exit 1
}
compose pull || failed pull
compose run --rm --no-deps migrate || failed migrate
compose run --rm --no-deps preflight || failed preflight
# shellcheck disable=SC2086
compose up -d --wait --wait-timeout 240 --remove-orphans $services || failed start
if [ -f .release.env ] && ! cmp -s .release.env .release.env.pending; then cp .release.env .release.env.previous; fi
mv .release.env.pending .release.env
echo "Deployed $(sed -n 's/^RELEASE_SHA=//p' .release.env)"
