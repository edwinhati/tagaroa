#!/bin/sh
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
  pgbackrest) echo "$*" >> "$PSQL_CALLS"; exit 0 ;;
  pg_isready) exit 0 ;;
  postgres) exec sleep 60 ;;
  psql)
    echo "$*" >> "$PSQL_CALLS"
    case "$*" in
      *pg_is_in_recovery*) echo f ;;
      *pg_database*)
        case "$*" in
          *"datname='$MISSING_DATABASE'"*) echo 0 ;;
          *) echo 1 ;;
        esac ;;
      *__drizzle_migrations*)
        [ "$RESTORED_CONTENTS" != missing-table ] || { echo 'relation does not exist' >&2; exit 1; }
        echo "$RESTORED_CONTENTS" ;;
      *) echo 'Unexpected SQL' >&2; exit 1 ;;
    esac ;;
  *) echo "Unexpected command: $command" >&2; exit 1 ;;
esac
SH
chmod +x "$tmp/bin/"*
run() {
  expected=$1; shift
  : > "$tmp/psql-calls"
  status=0
  env PATH="$tmp/bin:$PATH" PGDATA="$tmp/data/18/docker" PSQL_CALLS="$tmp/psql-calls" \
    REQUIRE_TAGAROA=1 RESTORED_CONTENTS=1 MISSING_DATABASE=none "$@" \
    sh "$tmp/restore-container.sh" > "$tmp/output" 2>&1 || status=$?
  [ "$status" = "$expected" ] || { cat "$tmp/output"; echo "FAIL: expected $expected, got $status ($*)"; exit 1; }
}

# Provisioning still requires the database, without inventing application rows.
run 0 RESTORE_TEST_REPO=2
grep -qF -- '--repo=2 info --output=json' "$tmp/psql-calls"
grep -qF -- '--repo=2 restore --type=immediate' "$tmp/psql-calls"
run 1 RESTORE_TEST_REPO=3
run 0 REQUIRE_TAGAROA_CONTENTS=0 RESTORED_CONTENTS=missing-table
grep -qF "datname='tagaroa'" "$tmp/psql-calls"
if grep -qF __drizzle_migrations "$tmp/psql-calls"; then
  echo 'FAIL: application query before initialization'; exit 1
fi
run 1 REQUIRE_TAGAROA_CONTENTS=0 MISSING_DATABASE=tagaroa
grep -qF 'Missing restored database: tagaroa' "$tmp/output"

# Initialized databases retain the migration/user checks and SQL failures.
run 0 REQUIRE_TAGAROA_CONTENTS=1
grep -qF 'drizzle.__drizzle_migrations' "$tmp/psql-calls"
grep -qF 'auth."user"' "$tmp/psql-calls"
run 1 REQUIRE_TAGAROA_CONTENTS=1 RESTORED_CONTENTS=0
grep -qF 'Tagaroa migration/user rows missing' "$tmp/output"
run 1 REQUIRE_TAGAROA_CONTENTS=1 RESTORED_CONTENTS=missing-table
grep -qF 'relation does not exist' "$tmp/output"
run 1 REQUIRE_TAGAROA_CONTENTS=1 MISSING_DATABASE=tagaroa

# An older host script defaults to strict contents checks.
run 1 RESTORED_CONTENTS=0
run 0 REQUIRE_TAGAROA=0
if grep -qF "datname='tagaroa'" "$tmp/psql-calls"; then
  echo 'FAIL: unexpected Tagaroa requirement'; exit 1
fi
for database in pangolin netbird arcane; do
  run 1 REQUIRE_TAGAROA=0 MISSING_DATABASE=$database
  grep -qF "Missing restored database: $database" "$tmp/output"
done
echo 'restore-container ok'
