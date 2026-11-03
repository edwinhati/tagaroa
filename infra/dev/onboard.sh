#!/bin/sh
# Usage: onboard.sh <core-image> <web-image> [first-super-admin-email]
# Run by a human on CT 105 in /home/tagaroa/apps, only before the first release:
# deploy.sh refuses to start images until two MFA-enrolled super-admins and a
# separate requester exist, and nobody can enrol while the app is stopped. This
# migrates and starts the stack so they can sign in and enrol. It skips preflight
# but records no release: the next deploy.sh still runs the full gate and, while
# operators are missing, stops core/web again.
set -eu
[ $# -ge 2 ] && [ $# -le 3 ] || { echo "usage: onboard.sh <core-image> <web-image> [email]" >&2; exit 2; }
cd "$(dirname "$0")"
test -f .env
[ ! -f .release.env ] || { echo "A release is already recorded; use deploy.sh." >&2; exit 1; }
umask 077

release_file=.release.env.onboarding
trap 'rm -f .release.env.onboarding' EXIT
printf 'CORE_IMAGE=%s\nWEB_IMAGE=%s\n' "$1" "$2" > "$release_file"
compose() { docker compose --env-file .env --env-file "$release_file" -f compose.yml "$@"; }

compose pull
compose up -d --wait postgres
compose run --rm --no-deps migrate
# ponytail: the container is recreated by the next deploy.sh; onboarding owns no release state.
compose up -d --wait --wait-timeout 240 core web
if [ $# -eq 3 ]; then
  # Prints a one-time temporary password; the account still needs a password change and MFA enrolment in the browser.
  compose run --rm --no-deps core bun scripts/bootstrap-admin.ts "$3"
fi
echo "Onboarding stack is up. Enrol operators in the browser, then run the dev deploy."
