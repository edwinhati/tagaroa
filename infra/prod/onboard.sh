#!/bin/sh
# Usage: onboard.sh [first-super-admin-email] < release
# The release has the same six KEY=value lines as deploy.sh's, naming images already
# in OCIR: the first release run promotes them before its preflight stops it.
# Run by a human on the OCI VM in /home/tagaroa/apps, only before the first release:
# deploy.sh refuses to start images until two MFA-enrolled super-admins and a
# separate requester exist, and nobody can enrol while the app is stopped. This
# migrates and starts the stack so they can sign in and enrol, while Pangolin keeps
# the prod hosts behind its SSO. It skips preflight but records no release: the next
# release still runs the full gate.
set -eu
if [ $# -gt 1 ]; then echo "usage: onboard.sh [email] < release" >&2; exit 2; fi
cd "$(dirname "$0")"
test -f .env
test -f .ocir
[ ! -f .release.env ] || { echo "A release is already recorded; use deploy.sh." >&2; exit 1; }
umask 077

release_file=.release.env.onboarding
trap 'rm -f .release.env.onboarding' EXIT
cat > "$release_file"
for key in RELEASE_SHA CORE_IMAGE AUTH_IMAGE ADMIN_IMAGE WORKSPACE_IMAGE ENGINEERING_IMAGE; do
  grep -q "^$key=" "$release_file" || { echo "onboard.sh: $key is missing" >&2; exit 2; }
done
compose() { docker compose --env-file .env --env-file "$release_file" -f compose.yml "$@"; }

set -a
# shellcheck source=/dev/null
. ./.ocir
set +a
printf '%s' "$OCIR_TOKEN" | docker login sin.ocir.io --username "$OCIR_USERNAME" --password-stdin
compose pull
compose run --rm --no-deps migrate
# ponytail: the containers are recreated by the next deploy.sh; onboarding owns no release state.
compose up -d --wait --wait-timeout 240 core auth admin workspace engineering
if [ $# -eq 1 ]; then
  # Prints a one-time temporary password; the account still needs a password change and MFA enrolment in the browser.
  compose run --rm --no-deps core bun scripts/bootstrap-admin.ts "$1"
fi
echo "Onboarding stack is up. Enrol operators in the browser, then approve the release again."
