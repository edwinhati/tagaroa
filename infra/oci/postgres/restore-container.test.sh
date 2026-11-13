#!/bin/sh
# Self-check for restore-container.sh, with gosu, pgBackRest and Postgres stubbed out:
#   sh infra/oci/postgres/restore-container.test.sh
set -eu
dir=$(cd "$(dirname "$0")" && pwd)
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
mkdir -p "$tmp/bin" "$tmp/result"
sed -e "s#/restore/#$tmp/result/#g" -e "s#/var/lib/postgresql#$tmp/data#g" \
  -e "s#/var/log/pgbackrest#$tmp/log#g" -e "s#/var/spool/pgbackrest#$tmp/spool#g" \
  "$dir/restore-container.sh" > "$tmp/restore-container.sh"
cat > "$tmp/bin/chown" <<'SH'
#!/bin/sh
SH
cat > "$tmp/bin/gosu" <<'SH'
#!/bin/sh
shift
command=$1; shift
case "$command" in
  pgbackrest) echo "pgbackrest $*" >> "$CALLS" ;;
  pg_isready) ;;
  postgres) exec sleep 60 ;;
  psql)
    echo "psql $*" >> "$CALLS"
    case "$*" in
      *pg_is_in_recovery*) echo f ;;
      *pg_database*)
        case "$*" in *"datname='$MISSING_DATABASE'"*) echo 0 ;; *) echo 1 ;; esac ;;
      *pg_class*)
        case "$*" in
          *"-d $BROKEN_DATABASE -v"*) echo 'database is not accepting connections' >&2; exit 1 ;;
          *) echo 42 ;;
        esac ;;
      *"id='before-marker'"*) echo "$BEFORE" ;;
      *"id='after-marker'"*) echo "$AFTER" ;;
      *) echo "Unexpected SQL: $*" >&2; exit 1 ;;
    esac ;;
  *) echo "Unexpected command: $command" >&2; exit 1 ;;
esac
SH
chmod +x "$tmp/bin/"*
run() {
  expected=$1; shift
  : > "$tmp/calls"
  status=0
  env PATH="$tmp/bin:$PATH" PGDATA="$tmp/data/18/docker" CALLS="$tmp/calls" \
    RESTORE_TEST_STANZA=main RESTORE_TEST_BACKUP=20261113-020000F \
    RESTORE_TEST_TARGET='2026-11-13 02:05:00.000000+00' RESTORE_TEST_DATABASES='postgres tagaroa' \
    RESTORE_TEST_MARKER=before-marker RESTORE_TEST_AFTER_MARKER=after-marker \
    MISSING_DATABASE=none BROKEN_DATABASE=none BEFORE=1 AFTER=0 "$@" \
    sh "$tmp/restore-container.sh" > "$tmp/output" 2>&1 || status=$?
  [ "$status" = "$expected" ] || { cat "$tmp/output"; echo "FAIL: expected $expected, got $status ($*)"; exit 1; }
}

# The chosen backup is recovered to the target time, then every database is opened.
run 0
grep -qF -- '--stanza=main --set=20261113-020000F restore --type=time --target=2026-11-13 02:05:00.000000+00 --target-action=promote' "$tmp/calls"
for database in postgres tagaroa; do
  grep -qF -- "-d $database -v ON_ERROR_STOP=1 -Atc SELECT count(*) FROM pg_catalog.pg_class" "$tmp/calls"
done
grep -qF 'PITR passed' "$tmp/output"

run 1 MISSING_DATABASE=tagaroa
grep -qF 'Missing restored database: tagaroa' "$tmp/output"
run 1 BROKEN_DATABASE=tagaroa
grep -qF 'database is not accepting connections' "$tmp/output"

# The markers prove the restore stopped at the target: the one before it is there,
# the one after it is not.
run 1 BEFORE=0
grep -qF 'Pre-target recovery marker missing' "$tmp/output"
run 1 AFTER=1
grep -qF 'Recovery passed the requested target' "$tmp/output"
echo 'restore-container ok'
