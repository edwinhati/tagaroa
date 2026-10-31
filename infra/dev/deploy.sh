#!/bin/sh
# Usage: deploy.sh <core-image> <web-image>
# Runs on CT 105 in /home/tagaroa/apps. On a failed migrate, preflight or start
# the previous images are brought back (schema changes are additive by policy,
# docs/security/access-control-rollout.md "Rollback") and the exit is non-zero.
set -eu
[ $# -eq 2 ] || { echo "usage: deploy.sh <core-image> <web-image>" >&2; exit 2; }
cd "$(dirname "$0")"
test -f .env
umask 077

compose() { docker compose --env-file .env --env-file .release.env -f compose.yml "$@"; }

if [ -f .release.env ]; then cp .release.env .release.env.previous; else rm -f .release.env.previous; fi
printf 'CORE_IMAGE=%s\nWEB_IMAGE=%s\n' "$1" "$2" > .release.env

# The workflow reads the "DEPLOY FAILED" line to name the failing step.
rollback() {
  echo "DEPLOY FAILED at step: $1" >&2
  if [ -f .release.env.previous ]; then
    cp .release.env.previous .release.env
    compose up -d --wait --wait-timeout 240 core web \
      || echo "ROLLBACK FAILED: previous images did not come back healthy" >&2
  else
    echo "No previous release to restore." >&2
  fi
  exit 1
}

compose pull || rollback pull
compose up -d --wait postgres || rollback postgres
compose run --rm --no-deps migrate || rollback migrate
compose run --rm --no-deps preflight || rollback preflight
compose up -d --wait --wait-timeout 240 --remove-orphans core web || rollback start
echo "Deployed $1 $2"
