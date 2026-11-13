#!/bin/sh
set -eu
mkdir -p "$PGDATA" /var/log/pgbackrest /var/spool/pgbackrest
chown -R postgres:postgres /var/lib/postgresql /var/log/pgbackrest /var/spool/pgbackrest
gosu postgres pgbackrest --config=/run/pgbackrest.conf --stanza="$RESTORE_TEST_STANZA" info --output=json > /restore/backup-info.json
gosu postgres pgbackrest --config=/run/pgbackrest.conf --stanza="$RESTORE_TEST_STANZA" \
  --set="$RESTORE_TEST_BACKUP" restore --type=time --target="$RESTORE_TEST_TARGET" --target-action=promote
gosu postgres postgres -D "$PGDATA" -c archive_mode=off -c listen_addresses= \
  -c unix_socket_directories=/tmp -c shared_buffers=128MB &
server=$!
trap 'kill -TERM "$server" 2>/dev/null || true; wait "$server" || true' EXIT
deadline=$(($(date +%s) + 600))
until gosu postgres pg_isready -h /tmp -U postgres >/dev/null 2>&1; do
  kill -0 "$server"
  [ "$(date +%s)" -lt "$deadline" ] || { echo 'Restore readiness timed out'; exit 1; }
  sleep 2
done
until [ "$(gosu postgres psql -h /tmp -U postgres -d postgres -Atc 'select pg_is_in_recovery()')" = f ]; do
  [ "$(date +%s)" -lt "$deadline" ] || { echo 'Restore promotion timed out'; exit 1; }
  sleep 2
done
for database in $RESTORE_TEST_DATABASES; do
  found=$(gosu postgres psql -h /tmp -U postgres -d postgres -v ON_ERROR_STOP=1 -Atc "SELECT count(*) FROM pg_database WHERE datname='$database'")
  [ "$found" = 1 ] || { echo "Missing restored database: $database"; exit 1; }
  # Opening every database checks more than catalog presence without assuming an app is initialized.
  gosu postgres psql -h /tmp -U postgres -d "$database" -v ON_ERROR_STOP=1 -Atc 'SELECT count(*) FROM pg_catalog.pg_class' >/dev/null
done
found=$(gosu postgres psql -h /tmp -U postgres -d postgres -v ON_ERROR_STOP=1 -Atc "SELECT count(*) FROM ops_recovery.markers WHERE id='$RESTORE_TEST_MARKER'")
[ "$found" = 1 ] || { echo 'Pre-target recovery marker missing'; exit 1; }
found=$(gosu postgres psql -h /tmp -U postgres -d postgres -v ON_ERROR_STOP=1 -Atc "SELECT count(*) FROM ops_recovery.markers WHERE id='$RESTORE_TEST_AFTER_MARKER'")
[ "$found" = 0 ] || { echo 'Recovery passed the requested target'; exit 1; }
printf 'PITR passed: pre-target marker present, post-target marker absent; databases: %s\n' "$RESTORE_TEST_DATABASES"
