#!/bin/bash
# Self-test for gates.sh, against a throwaway git repository.
set -euo pipefail
gates="$(cd "$(dirname "$0")" && pwd)/gates.sh"
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
cd "$tmp"
git init -q
git config user.email test@example.invalid
git config user.name test
commit() { git add -A && git commit -qm "$1" && git rev-parse HEAD; }
# Formatted as oxfmt writes it: range searches for the exact `"version": "X.Y.Z"` line.
version() { mkdir -p servers/core/drizzle && printf '{\n  "name": "@servers/core",\n  "version": "%s"\n}\n' "$1" > servers/core/package.json; }
# A bare [[ ]] does not stop macOS's bash 3.2 under set -e.
check() { "$@" || { echo "Failed: $*"; exit 1; }; }
fails() { if "$@" > out 2>&1; then echo "Expected a failure: $*"; cat out; exit 1; fi; }

version 0.1.0
printf 'PORT=8080\n' > servers/core/.env.example
printf 'CREATE TABLE "a" ("id" text);\n' > servers/core/drizzle/0000_init.sql
v010=$(commit 'core 0.1.0')
printf 'CREATE TABLE "b" ("id" text);\n--> statement-breakpoint\n-- a comment that says drop table\n' > servers/core/drizzle/0001_add.sql
add=$(commit 'additive')
version 0.2.0
v020=$(commit 'core 0.2.0')

# range: nothing for a first release or an unchanged core; else the commit of prod's version.
check test -z "$(bash "$gates" range HEAD '')"
check test -z "$(bash "$gates" range HEAD 0.2.0)"
check test "$(bash "$gates" range HEAD 0.1.0)" = "$v010"
fails bash "$gates" range HEAD 0.0.9
echo 'PASS: range'

bash "$gates" migrations "$v010" "$add" > out
grep -q '0001_add.sql: adds only' out
printf 'DELETE FROM "a";\n' > servers/core/drizzle/0002_dedup.sql
destructive=$(commit 'destructive')
fails bash "$gates" migrations "$v020" "$destructive"
grep -q '0002_dedup.sql changes or removes existing schema' out
git reset -q --hard "$v020"
printf -- '-- migration-guard: allow  \nDELETE FROM "a";\n' > servers/core/drizzle/0002_dedup.sql
fails bash "$gates" migrations "$v020" "$(commit 'empty reason')"
git reset -q --hard "$v020"
printf -- '-- migration-guard: allow duplicates were never valid\nDELETE FROM "a";\n' > servers/core/drizzle/0002_dedup.sql
bash "$gates" migrations "$v020" "$(commit 'allowed')" > out
grep -q 'allowed: duplicates were never valid' out
git reset -q --hard "$v020"
printf -- '-- migration-guard: allow just in case\nCREATE TABLE "c" ("id" text);\n' > servers/core/drizzle/0002_more.sql
fails bash "$gates" migrations "$v020" "$(commit 'needless allow')"
grep -q 'its migration-guard allow is not needed' out
git reset -q --hard "$v020"
printf 'CREATE TABLE "a" ("id" text, "x" text);\n' > servers/core/drizzle/0000_init.sql
fails bash "$gates" migrations "$v010" "$(commit 'edited')"
grep -q '0000_init.sql: an applied migration was changed or removed' out
echo 'PASS: migrations'

git reset -q --hard "$v020"
printf 'PORT=8080\nNEW_KEY=x\n# OPTIONAL_KEY=\n' > servers/core/.env.example
keys=$(commit 'new key')
printf 'PORT\n' > prod-keys
fails bash "$gates" config "$v020" "$keys" prod-keys
grep -q 'NEW_KEY is new' out
if grep -q OPTIONAL_KEY out; then echo 'A commented key was required'; exit 1; fi
printf 'PORT\nNEW_KEY\n' > prod-keys
bash "$gates" config "$v020" "$keys" prod-keys > out
grep -q 'NEW_KEY: on prod' out
echo 'PASS: config'
