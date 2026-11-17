#!/bin/bash
set -e

# Creates the tagaroa database and role (password tagaroa) that
# servers/core/.env.example connects with, on first initialization.
#
# Idempotent by design: POSTGRES_USER or POSTGRES_DB may already name one of
# them (docker-compose.yml sets both to `postgres`, but a developer can change
# that), and a bare CREATE for one that exists would abort the whole init under
# ON_ERROR_STOP=1, leaving the rest uncreated.
#
# PostgreSQL >= 15 revokes CREATE on the public schema from PUBLIC, so each role
# also needs an explicit schema grant or its migrations fail with
# "permission denied for schema public". The owner is pg_database_owner, so that
# grant must run as a superuser — $POSTGRES_USER is one on a fresh volume.

psql_super() { psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" "$@"; }

exists() { test -n "$(psql_super --dbname "$POSTGRES_DB" -tAc "$1")"; }

# db:role; an empty role leaves the database to $POSTGRES_USER. Only databases
# something connects to locally belong here. Core's tests create their own
# tagaroa_test (servers/core/test/database.ts).
# shellcheck disable=SC2043 # a list of one, kept as a list so more can be added
for spec in tagaroa:tagaroa; do
    db="${spec%%:*}"; role="${spec##*:}"

    exists "SELECT 1 FROM pg_database WHERE datname='$db'" \
        || psql_super --dbname "$POSTGRES_DB" -c "CREATE DATABASE $db"

    [ -n "$role" ] || continue

    exists "SELECT 1 FROM pg_roles WHERE rolname='$role'" \
        || psql_super --dbname "$POSTGRES_DB" -c "CREATE USER $role WITH PASSWORD '$role'"

    psql_super --dbname "$POSTGRES_DB" -c "GRANT ALL PRIVILEGES ON DATABASE $db TO $role"
    psql_super --dbname "$db" -c "GRANT ALL ON SCHEMA public TO $role"
done
