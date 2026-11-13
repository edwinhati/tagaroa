#!/bin/bash
set -euo pipefail
umask 077
cd /home/docker/postgres
exec 9>/run/lock/pgbackrest-restore-test.lock
flock -n 9 || { echo 'A restore test is already running'; exit 1; }
root=$(cd "$(dirname "$0")" && pwd)
started=$(date +%s)
id="pgrestore-$started-$$"
scratch=$(mktemp -d)
chmod 755 "$scratch"
# Every phase logs to restore.log; fds 3 and 4 keep the journal for the summary.
exec 3>&1 4>&2 >"$scratch/restore.log" 2>&1
step=prepare
finish() {
  result=$?
  trap - EXIT
  # Cleanup errors must not hide a failing test, or leave a passing metric.
  docker rm -f "$id" >/dev/null 2>&1 || true
  if docker volume inspect "$id" >/dev/null 2>&1; then
    docker volume rm "$id" >/dev/null || result=1
  fi
  if docker network inspect "$id" >/dev/null 2>&1; then
    docker network rm "$id" >/dev/null || result=1
  fi
  exec >&3 2>&4
  if [ "$result" -ne 0 ]; then
    echo "Restore test failed at $step (exit $result)"
    # pgBackRest logs first, so the file ends with the failing phase.
    {
      find "$scratch/pgbackrest-log" -type f -name '*.log' -exec tail -n 30 {} \; 2>/dev/null || true
      cat "$scratch/restore.log"
      echo "Restore test failed at $step (exit $result)"
    } > "$root/restore-test-last.log"
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
required=$(docker exec postgres psql -U postgres -Atc "SELECT count(*) FROM pg_database WHERE datname='tagaroa'")
contents=0
if [ "$required" = 1 ]; then
  # An empty provisioned database is not yet an application deployment.
  schemas=$(docker exec postgres psql -U postgres -d tagaroa -Atc "SELECT count(*) FROM pg_namespace WHERE nspname IN ('auth', 'drizzle')")
  if [ "$schemas" -gt 0 ]; then contents=1; fi
fi
docker volume create "$id" >/dev/null
docker network create "$id" >/dev/null
mkdir "$scratch/result"
chmod 777 "$scratch/result"
mkdir "$scratch/pgbackrest-log"
chmod 777 "$scratch/pgbackrest-log"
cat > "$scratch/override.yml" <<YAML
services:
  postgres:
    container_name: $id
    restart: "no"
    environment:
      RESTORE_TEST_STANZA: $stanza
      REQUIRE_TAGAROA: "$required"
      REQUIRE_TAGAROA_CONTENTS: "$contents"
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
# The override replaces ALL live volumes and networks, including log/spool.
docker compose -p "$id" -f compose.yaml -f "$scratch/override.yml" run \
  --rm --no-deps --name "$id" postgres sh /restore-container.sh
step=backup-age
python3 - "$scratch/result/backup-info.json" <<'PY'
import json, sys, time
stanzas = json.load(open(sys.argv[1]))
backups = [b for s in stanzas for b in s.get("backup", []) if not b.get("error")]
assert backups, "No successful backup"
age = time.time() - max(b["timestamp"]["stop"] for b in backups)
assert 0 <= age < 48 * 3600, "Newest backup is older than 48 hours"
PY
step=cleanup
docker volume rm "$id" >/dev/null
docker network rm "$id" >/dev/null
step=record-metric
address=$(docker inspect victoriametrics --format '{{(index .NetworkSettings.Networks "monitoring_backend").IPAddress}}')
printf 'pgbackrest_restore_test_last_success_timestamp_seconds %s\n' "$(date +%s)" \
  | curl --fail --silent --show-error --max-time 30 --data-binary @- \
      "http://$address:8428/api/v1/import/prometheus"
