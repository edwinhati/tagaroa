#!/bin/sh
# Self-check for restore-test.sh failure alerts, with Docker stubbed out:
#   sh infra/oci/postgres/restore-test.test.sh
set -eu
dir=$(cd "$(dirname "$0")" && pwd)
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

fixture_root=$tmp/home/docker
mkdir -p "$fixture_root/postgres/pgbackrest" "$fixture_root/monitoring/alertmanager" "$tmp/bin"
echo https://example.invalid/hook > "$fixture_root/monitoring/alertmanager/ops-webhook-url"
sed -e "s#/home/docker#$fixture_root#g" -e "s#/run/lock#$tmp#g" "$dir/restore-test.sh" \
  > "$fixture_root/postgres/pgbackrest/restore-test.sh"
cat > "$fixture_root/postgres/pgbackrest/ops-alert.sh" <<SH
exec sh "$dir/../../ops/ops-alert.sh" --dry-run "\$@" > "$tmp/alert.json"
SH

cat > "$tmp/bin/flock" <<'SH'
#!/bin/sh
SH
cat > "$tmp/bin/curl" <<'SH'
#!/bin/sh
SH
cat > "$tmp/bin/docker" <<'SH'
#!/bin/sh
case "$1 $2" in
  'exec postgres')
    [ -z "${FAIL_PREPARE:-}" ] || { echo 'Error response from daemon: No such container: postgres' >&2; exit 1; }
    echo 0 ;;
  'volume rm')
    [ -z "${FAIL_CLEANUP:-}" ] || { echo 'Error response from daemon: volume is in use' >&2; exit 1; } ;;
  'inspect victoriametrics') echo 127.0.0.1 ;;
  compose*)
    while [ "$1" != run ]; do override=$1; shift; done
    scratch=$(dirname "$override")
    stop=$(($(date +%s) - AGE_HOURS * 3600))
    echo "[{\"backup\":[{\"timestamp\":{\"stop\":$stop}}]}]" > "$scratch/result/backup-info.json"
    i=0; while [ $i -lt 30 ]; do i=$((i + 1)); echo "pgbackrest $i"; done > "$scratch/pgbackrest-log/main-restore.log"
    i=0; while [ $i -lt 60 ]; do i=$((i + 1)); echo "replay $i"; done
    echo 'Restored database checks passed.' ;;
esac
SH
chmod +x "$tmp/bin/"*

# run EXPECTED_STATUS [ENV=VALUE...]: runs the copied script, returns nothing.
run() {
  rm -f "$tmp/alert.json"
  expected=$1; shift
  status=0
  env PATH="$tmp/bin:$PATH" AGE_HOURS=1 "$@" bash "$fixture_root/postgres/pgbackrest/restore-test.sh" \
    > "$tmp/journal" 2>&1 || status=$?
  [ "$status" = "$expected" ] || { echo "FAIL: $* exited $status"; cat "$tmp/journal"; exit 1; }
}
expect_alert() {
  for text in "$@"; do
    grep -qF "$text" "$tmp/alert.json" || { echo "FAIL: alert lacks $text"; cat "$tmp/alert.json"; exit 1; }
  done
}

run 0
[ ! -e "$tmp/alert.json" ] || { echo 'FAIL: alert on pass'; exit 1; }

run 1 AGE_HOURS=49
expect_alert '"step":"backup-age"' 'Newest backup is older than 48 hours' 'failed at backup-age (exit 1)'

run 1 FAIL_PREPARE=1
expect_alert '"step":"prepare"' 'No such container: postgres'

run 1 FAIL_CLEANUP=1
expect_alert '"step":"cleanup"' 'volume is in use'

grep -qF 'Restore test failed at cleanup' "$tmp/journal" || { echo 'FAIL: journal summary'; exit 1; }
echo "restore-test ok"
