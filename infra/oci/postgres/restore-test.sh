#!/bin/bash
set -euo pipefail
umask 077
cd /home/docker/postgres
exec 9>/run/lock/pgbackrest-restore-test.lock
flock -n 9 || { echo 'A restore test is already running'; exit 1; }
root=/home/docker/postgres/pgbackrest
started=$(date +%s)
id="pgrestore-$started-$$"
scratch=$(mktemp -d)
chmod 755 "$scratch"
exec 3>&1 4>&2 >"$scratch/restore.log" 2>&1
step=prepare
finish() {
  result=$?
  trap - EXIT
  if [ "$result" -ne 0 ]; then
    find "$scratch/pgbackrest-log" -type f -name '*.log' -exec tail -n 60 {} \; >>"$scratch/restore.log" 2>/dev/null || true
  fi
  docker rm -f "$id" >/dev/null 2>&1 || true
  if docker volume inspect "$id" >/dev/null 2>&1; then docker volume rm "$id" >/dev/null || result=1; fi
  if docker network inspect "$id" >/dev/null 2>&1; then docker network rm "$id" >/dev/null || result=1; fi
  exec >&3 2>&4
  install -m 600 "$scratch/restore.log" "$root/restore-test-last.log"
  if [ "$result" -ne 0 ]; then
    echo "Restore test failed at $step (exit $result)"
  else
    echo "Restore test passed in $(($(date +%s) - started)) seconds"
  fi
  rm -rf "$scratch"
  exit "$result"
}
trap finish EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
stanza=${RESTORE_TEST_STANZA:-main}
[[ "$stanza" =~ ^[a-zA-Z0-9_-]+$ ]] || { echo 'Invalid stanza'; exit 1; }
pg() { docker exec -u postgres postgres psql -U postgres -d postgres -v ON_ERROR_STOP=1 -Atc "$1"; }
backup=$(docker exec -u postgres postgres pgbackrest --config=/run/pgbackrest.conf --stanza="$stanza" --output=json info | python3 -c 'import sys,json,time; bs=[b for s in json.load(sys.stdin) for b in s.get("backup",[]) if not b.get("error")]; b=max(bs,key=lambda b:b["timestamp"]["stop"]); assert 0 <= time.time()-b["timestamp"]["stop"] < 48*3600,"Newest backup older than 48h"; print(b["label"])')
databases=$(pg "SELECT string_agg(datname,' ' ORDER BY datname) FROM pg_database WHERE datallowconn AND NOT datistemplate")
[[ "$databases" =~ ^[a-zA-Z0-9_\ -]+$ ]] || { echo 'Database identifier needs explicit quoting support'; exit 1; }
pg 'CREATE SCHEMA IF NOT EXISTS ops_recovery; CREATE TABLE IF NOT EXISTS ops_recovery.markers(id text PRIMARY KEY, committed_at timestamptz NOT NULL DEFAULT clock_timestamp());' >/dev/null
marker="$id-before"
after="$id-after"
pg "INSERT INTO ops_recovery.markers(id) VALUES ('$marker')" >/dev/null
target=$(pg "SELECT to_char(clock_timestamp() AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS.US') || '+00'")
pg "INSERT INTO ops_recovery.markers(id) VALUES ('$after')" >/dev/null
wal=$(pg 'SELECT pg_walfile_name(pg_current_wal_insert_lsn())')
pg 'SELECT pg_switch_wal()' >/dev/null
step=archive-marker
deadline=$(($(date +%s)+120))
until [ "$(pg "SELECT COALESCE(last_archived_wal >= '$wal',false) FROM pg_stat_archiver")" = t ]; do
  [ "$(date +%s)" -lt "$deadline" ] || { echo 'Recovery markers did not archive in 120s'; exit 1; }
  sleep 2
done
echo "Selected backup $backup, target $target; target WAL archived."
image=$(docker inspect postgres --format '{{.Image}}')
docker volume create "$id" >/dev/null
docker network create "$id" >/dev/null
mkdir "$scratch/result" "$scratch/pgbackrest-log"
chmod 777 "$scratch/result" "$scratch/pgbackrest-log"
cat > "$scratch/override.yml" <<YAML
services:
  postgres:
    image: $image
    pull_policy: never
    container_name: $id
    restart: "no"
    healthcheck:
      disable: true
    environment:
      RESTORE_TEST_STANZA: "$stanza"
      RESTORE_TEST_BACKUP: "$backup"
      RESTORE_TEST_TARGET: "$target"
      RESTORE_TEST_DATABASES: "$databases"
      RESTORE_TEST_MARKER: "$marker"
      RESTORE_TEST_AFTER_MARKER: "$after"
    volumes: !override
      - $id:/var/lib/postgresql
      - $root/pgbackrest.conf.template:/etc/pgbackrest/pgbackrest.conf.template:ro
      - $root/restore-container.sh:/restore-container.sh:ro
      - $scratch/result:/restore
      - $scratch/pgbackrest-log:/var/log/pgbackrest
    networks: !override
      - restore
    ports: !reset []
networks:
  restore:
    external: true
    name: $id
volumes:
  $id:
    external: true
YAML
step=restore-and-verify
docker compose -p "$id" -f compose.yaml -f "$scratch/override.yml" run --rm --no-deps --name "$id" postgres sh /restore-container.sh
step=record-metric
address=$(docker inspect victoriametrics --format '{{(index .NetworkSettings.Networks "monitoring_backend").IPAddress}}')
printf 'pgbackrest_restore_test_last_success_timestamp_seconds %s\npgbackrest_restore_test_duration_seconds %s\n' "$(date +%s)" "$(($(date +%s)-started))" | curl --fail --silent --show-error --max-time 30 --data-binary @- "http://$address:8428/api/v1/import/prometheus"
step=complete
