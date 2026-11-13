#!/bin/sh
# Self-check for restore-test.sh, with Docker stubbed out:
#   sh infra/oci/postgres/restore-test.test.sh
set -eu
dir=$(cd "$(dirname "$0")" && pwd)
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

fixture_root=$tmp/home/docker
mkdir -p "$fixture_root/postgres/pgbackrest" "$tmp/bin"
sed -e "s#/home/docker#$fixture_root#g" -e "s#/run/lock#$tmp#g" "$dir/restore-test.sh" \
  > "$fixture_root/postgres/pgbackrest/restore-test.sh"
report=$fixture_root/postgres/pgbackrest/restore-test-last.log

cat > "$tmp/bin/flock" <<'SH'
#!/bin/sh
SH
cat > "$tmp/bin/curl" <<'SH'
#!/bin/sh
cat > "$METRIC"
SH
cat > "$tmp/bin/docker" <<'SH'
#!/bin/sh
echo "docker $*" >> "$CALLS"
case "$1" in
  exec)
    [ -z "${FAIL_PREPARE:-}" ] || { echo 'Error response from daemon: No such container: postgres' >&2; exit 1; }
    case "$*" in
      *pgbackrest*info*)
        stop=$(($(date +%s) - AGE_HOURS * 3600))
        echo "[{\"backup\":[{\"label\":\"20261113-020000F\",\"timestamp\":{\"stop\":$stop}}]}]" ;;
      *string_agg*) echo 'postgres tagaroa' ;;
      *to_char*) echo '2026-11-13 02:05:00.000000+00' ;;
      *pg_walfile_name*) echo 000000010000000000000042 ;;
      *pg_stat_archiver*) echo t ;;
    esac ;;
  inspect)
    case "$2" in
      postgres) echo sha256:fixture ;;
      victoriametrics) echo 127.0.0.1 ;;
    esac ;;
  volume)
    [ "$2" != rm ] || [ -z "${FAIL_CLEANUP:-}" ] || { echo 'Error response from daemon: volume is in use' >&2; exit 1; } ;;
  compose)
    while [ "$1" != run ]; do override=$1; shift; done
    cp "$override" "$FIXTURE_OVERRIDE"
    [ -z "${FAIL_RESTORE:-}" ] || { echo 'Pre-target recovery marker missing'; exit 1; }
    echo 'PITR passed' ;;
esac
SH
chmod +x "$tmp/bin/"*

# run EXPECTED_STATUS [ENV=VALUE...]: runs the copied script, returns nothing.
run() {
  rm -f "$report"
  : > "$tmp/calls"
  : > "$tmp/metric"
  expected=$1; shift
  status=0
  env PATH="$tmp/bin:$PATH" CALLS="$tmp/calls" METRIC="$tmp/metric" FIXTURE_OVERRIDE="$tmp/override.yml" \
    AGE_HOURS=1 "$@" bash "$fixture_root/postgres/pgbackrest/restore-test.sh" > "$tmp/journal" 2>&1 || status=$?
  [ "$status" = "$expected" ] || { echo "FAIL: $* exited $status"; cat "$tmp/journal"; exit 1; }
}
expect() { # FILE TEXT...
  file=$1; shift
  for text in "$@"; do
    grep -qF -- "$text" "$file" || { echo "FAIL: $file lacks $text"; cat "$file"; exit 1; }
  done
}
line() { grep -nF -- "$1" "$tmp/calls" | head -n 1 | cut -d: -f1; }

run 0
expect "$tmp/override.yml" 'RESTORE_TEST_BACKUP: "20261113-020000F"' \
  'RESTORE_TEST_TARGET: "2026-11-13 02:05:00.000000+00"' 'RESTORE_TEST_DATABASES: "postgres tagaroa"'
grep -qE 'RESTORE_TEST_MARKER: "pgrestore-[0-9]+-[0-9]+-before"' "$tmp/override.yml"
grep -qE 'RESTORE_TEST_AFTER_MARKER: "pgrestore-[0-9]+-[0-9]+-after"' "$tmp/override.yml"
# The target sits between the two markers, and both are in WAL that gets archived.
before=$(line "-before')") target=$(line to_char) after=$(line "-after')") switch=$(line 'pg_switch_wal()')
if [ "$before" -ge "$target" ] || [ "$target" -ge "$after" ] || [ "$after" -ge "$switch" ]; then
  echo 'FAIL: the markers must bracket the target before the WAL switch'; cat "$tmp/calls"; exit 1
fi
expect "$tmp/metric" pgbackrest_restore_test_last_success_timestamp_seconds
expect "$tmp/journal" 'Restore test passed'
expect "$report" 'Selected backup 20261113-020000F' 'PITR passed'

run 1 AGE_HOURS=49
expect "$report" 'Newest backup older than 48h'
expect "$tmp/journal" 'failed at prepare (exit 1)'

run 1 FAIL_PREPARE=1
expect "$report" 'No such container: postgres'

run 1 FAIL_RESTORE=1
expect "$report" 'Pre-target recovery marker missing'
expect "$tmp/journal" 'failed at restore-and-verify (exit 1)'
[ ! -s "$tmp/metric" ] || { echo 'FAIL: metric recorded for a failed restore'; exit 1; }

run 1 FAIL_CLEANUP=1
expect "$report" 'volume is in use'
expect "$tmp/journal" 'failed at complete (exit 1)'

run 1 RESTORE_TEST_STANZA='bad stanza'
expect "$report" 'Invalid stanza'
if grep -qF 'docker exec' "$tmp/calls"; then echo 'FAIL: touched the live database with a bad stanza'; exit 1; fi
echo "restore-test ok"
