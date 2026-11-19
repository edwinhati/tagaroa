#!/bin/sh
# Backs up the Frappe HR site (database and files) and copies it off the host. Run nightly from
# the directory holding compose.yaml, .env and rclone.conf, as a user that can run docker:
#
#   15 2 * * * sh /home/docker/frappe/backup.sh >>/home/docker/frappe/backup.log 2>&1
#
# Frappe deletes its local copies after a day; the remote keeps them, so set retention there.
set -eu
cd "$(dirname "$0")"
set -a
# shellcheck source=/dev/null
. ./.env
set +a
: "${SITE:?}" "${BACKUP_REMOTE:?}"

docker compose exec -T backend bench --site "$SITE" backup --with-files --compress
docker compose run --rm backup copy "/sites/$SITE/private/backups" "$BACKUP_REMOTE/$SITE"
echo "$(date -u +%FT%TZ) backed up $SITE to $BACKUP_REMOTE/$SITE"
