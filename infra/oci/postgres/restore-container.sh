#!/bin/sh
set -eu
stanza=${RESTORE_TEST_STANZA:-main}
mkdir -p "$PGDATA" /var/log/pgbackrest /var/spool/pgbackrest
chown -R postgres:postgres /var/lib/postgresql /var/log/pgbackrest /var/spool/pgbackrest
gosu postgres pgbackrest --config=/run/pgbackrest.conf --stanza="$stanza" info --output=json > /restore/backup-info.json
gosu postgres pgbackrest --config=/run/pgbackrest.conf --stanza="$stanza" restore --type=immediate --target-action=promote

# Only a Unix socket is exposed. WAL replay may read the repository, but this
# container has no network in common with the live database.
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
# A ready server can still be replaying WAL. Wait for promotion before checks.
until [ "$(gosu postgres psql -h /tmp -U postgres -Atc 'select pg_is_in_recovery()')" = f ]; do
  [ "$(date +%s)" -lt "$deadline" ] || { echo 'Restore promotion timed out'; exit 1; }
  sleep 2
done
for database in pangolin netbird arcane; do
  found=$(gosu postgres psql -h /tmp -U postgres -Atc "SELECT count(*) FROM pg_database WHERE datname='$database'")
  [ "$found" = 1 ] || { echo "Missing restored database: $database"; exit 1; }
done
if [ "$REQUIRE_TAGAROA" = 1 ]; then
  found=$(gosu postgres psql -h /tmp -U postgres -Atc "SELECT count(*) FROM pg_database WHERE datname='tagaroa'")
  [ "$found" = 1 ] || { echo 'Missing restored database: tagaroa (the selected backup may predate provisioning)'; exit 1; }
fi
if [ "${REQUIRE_TAGAROA_CONTENTS:-$REQUIRE_TAGAROA}" = 1 ]; then
  gosu postgres psql -h /tmp -U postgres -d tagaroa -v ON_ERROR_STOP=1 -Atc \
    'SELECT CASE WHEN (SELECT count(*) FROM drizzle.__drizzle_migrations) > 0 AND (SELECT count(*) FROM auth."user") > 0 THEN 1 ELSE 0 END' \
    > /restore/tagaroa-check
  [ "$(cat /restore/tagaroa-check)" = 1 ] || { echo 'Tagaroa migration/user rows missing'; exit 1; }
fi
echo 'Restored database checks passed.'
