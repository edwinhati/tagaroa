#!/bin/sh
# drizzle-orm's migrator decides what to run by comparing the newest applied
# `created_at` with each migration's journal timestamp. It never compares
# hashes, so a migration edited after it landed on main is silently skipped
# by every database that already applied it. Only new files are allowed.
#
# Usage: check-migrations.sh [base-ref]   (default origin/main)
base=${1:-origin/main}
dir=servers/core/drizzle

changed=$(
  git diff --name-status --diff-filter=MDR "$base...HEAD" -- "$dir" |
    grep -E "\s$dir/[0-9]{4}_[^/]*\.sql$"
)

if [ -n "$changed" ]; then
  echo "migrations: files already on $base were changed or removed:" >&2
  echo "$changed" | sed 's/^/  /' >&2
  echo "Never edit an applied migration; add a new one (docs/ops/migrations.md)." >&2
  exit 1
fi
