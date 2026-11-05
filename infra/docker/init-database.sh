#!/bin/bash
set -e

# Create per-app databases, roles, and privileges on first initialization.
#
# Idempotent by design: POSTGRES_USER and POSTGRES_DB may already be one of the
# names below (docker-compose.yml defaults both to `tagaroa`, .env.example sets
# both to `postgres`), and a bare CREATE for one that exists would abort the
# whole init under ON_ERROR_STOP=1 — leaving every later database uncreated.
#
# PostgreSQL >= 15 revokes CREATE on the public schema from PUBLIC, so each role
# also needs an explicit schema grant or its migrations fail with
# "permission denied for schema public". The owner is pg_database_owner, so that
# grant must run as a superuser — $POSTGRES_USER is one on a fresh volume.

psql_super() { psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" "$@"; }

exists() { test -n "$(psql_super --dbname "$POSTGRES_DB" -tAc "$1")"; }

# db:role — an empty role means the database is owned by $POSTGRES_USER and is
# reached with the superuser's credentials, which is what every local .env.example
# in this repo already does (servers/core -> auth, and the two ventures below).
# Only databases something actually connects to locally belong here: flow is on
# Neon, traccar and the k8s-only databases are not served from this container.
# The ventures need only their base database — server/src/test/harness.ts derives
# and creates <db>_test itself on first run.
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
