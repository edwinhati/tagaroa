#!/bin/sh
set -eu
cd "$(dirname "$0")"
umask 077
release_file=.release.env.pending
compose() { docker compose --env-file .env --env-file "$release_file" -f compose.yml "$@"; }
trap 'rm -f .release.env.pending' EXIT
rollback() {
  if [ ! -f .release.env.previous ]; then
    if [ -f .release.env ]; then release_file=.release.env; compose stop core web; rm -f .release.env; fi
    echo 'No previous release exists; first-release services stopped.'
    return 0
  fi
  cp .release.env.previous .release.env
  release_file=.release.env
  compose up -d --wait --wait-timeout 240 core web
}
if [ "${1:-}" = --rollback ]; then rollback; exit; fi
[ $# -eq 2 ] || { echo 'usage: deploy.sh <core-image> <web-image> | --rollback' >&2; exit 2; }
test -f .env
test -f .ocir
set -a
# shellcheck source=/dev/null
. ./.ocir
set +a
printf '%s' "$OCIR_TOKEN" | docker login sin.ocir.io --username "$OCIR_USERNAME" --password-stdin
printf 'CORE_IMAGE=%s\nWEB_IMAGE=%s\n' "$1" "$2" > .release.env.pending
failed() {
  echo "Deployment failed at $1" >&2
  if [ -f .release.env ]; then
    release_file=.release.env
    compose up -d --wait --wait-timeout 240 core web || { echo 'ROLLBACK FAILED' >&2; exit 2; }
  else
    compose stop core web || { echo 'ROLLBACK FAILED' >&2; exit 2; }
    rm -f .release.env
    echo 'First release failed; no previous deployment exists.' >&2
  fi
  exit 1
}
compose pull || failed pull
compose run --rm --no-deps migrate || failed migrate
compose run --rm --no-deps preflight || failed preflight
compose up -d --wait --wait-timeout 240 --remove-orphans core web || failed start
if [ -f .release.env ] && ! cmp -s .release.env .release.env.pending; then cp .release.env .release.env.previous; fi
mv .release.env.pending .release.env
echo "Deployed $1 $2"
