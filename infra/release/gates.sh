#!/bin/bash
# The checks a person used to make before approving a release, as code. Production's
# Test step runs both; pull requests run `migrations` (development.yml), so a
# migration that needs an allow gets it before dev applies it and the file is frozen.
#
#   bash infra/release/gates.sh migrations <from> <to>
#   bash infra/release/gates.sh config <from> <to> <file of prod's .env key names>
#   bash infra/release/gates.sh range <to> <prod's core version>   (prints <from>, or nothing)
#
# migrations: every migration added in from..to only adds (tables, columns, indexes).
#   Rollback restores images, never the schema, so anything else must be marked in
#   its file with `-- migration-guard: allow <reason>`. An allow on an additive
#   migration fails too, so none is left behind by mistake. Changing or removing an
#   applied migration always fails (scripts/ci/check-migrations.sh blocks it on PRs).
# config: every key added uncommented to servers/core/.env.example in from..to is in
#   prod's .env. Keys that were there before already work on prod.
# range: core ships migrations and needs config only with a new version, so <from>
#   is the commit that set prod's core version, the tree its image was built from.
#   Nothing is printed when core keeps its version, or for the first release
#   (no prod version): its database is empty and its .env set up by hand.
set -euo pipefail
non_additive='drop (table|column|schema|index|constraint)|rename|alter column|truncate|delete from|set not null|alter table .* type '

case ${1:-} in
  range)
    to=${2:?} prod=${3-}
    now=$(git show "$to:servers/core/package.json" | jq -r .version)
    [[ -n $prod && $prod != "$now" ]] || exit 0
    from=$(git log --format=%H -S"\"version\": \"$prod\"" "$to" -- servers/core/package.json | tail -1)
    [[ -n $from ]] || { echo "No commit on $to sets core $prod, so what prod runs is unknown." >&2; exit 1; }
    echo "$from"
    ;;
  migrations)
    from=${2:?} to=${3:?} failed=0
    while IFS=$'\t' read -r status file; do
      [[ $file == *.sql ]] || continue
      name=${file##*/}
      if [[ $status != A ]]; then
        echo "::error::$name: an applied migration was changed or removed."; failed=1; continue
      fi
      sql=$(git show "$to:$file")
      allow=$(grep -m1 -E '^-- migration-guard: allow ' <<< "$sql" || true)
      reason=$(sed -E 's/^-- migration-guard: allow +//' <<< "$allow")
      if grep -v '^[[:space:]]*--' <<< "$sql" | grep -qiE "$non_additive"; then
        if [[ -n ${reason// /} ]]; then echo "$name: not additive, allowed: $reason"
        else echo "::error::$name changes or removes existing schema, which a rollback cannot undo. If that is safe, say why in the file: -- migration-guard: allow <reason>"; failed=1; fi
      elif [[ -n $allow ]]; then
        echo "::error::$name only adds, so its migration-guard allow is not needed. Remove it."; failed=1
      else
        echo "$name: adds only"
      fi
    done < <(git diff --name-status --no-renames "$from" "$to" -- servers/core/drizzle/)
    exit "$failed"
    ;;
  config)
    from=${2:?} to=${3:?} keys=${4:?} failed=0
    while read -r key; do
      if grep -qxF "$key" "$keys"; then echo "$key: on prod"
      else echo "::error::$key is new in servers/core/.env.example and missing from prod's .env. Add it on the VM, then re-run."; failed=1; fi
    done < <(git diff -U0 "$from" "$to" -- servers/core/.env.example | sed -nE 's/^\+([A-Z][A-Z0-9_]*)=.*/\1/p' | sort -u)
    exit "$failed"
    ;;
  *) echo 'usage: gates.sh migrations|config|range …' >&2; exit 2 ;;
esac
