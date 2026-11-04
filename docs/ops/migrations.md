# Migrations

Database migrations for `servers/core` live in `servers/core/drizzle` and run
through drizzle-orm's migrator (`db:migrate`). Two properties of that migrator
decide the rules below (see `database-review.md`, M1 and M2).

## Never edit an applied migration

The migrator compares only the newest applied `created_at` with each journal
entry's timestamp. It stores a hash but never checks it, so a database that
applied the old file skips your edit and `migrate` still reports success.
`0000_init.sql` was changed this way once (the `hr` schema was added after the
first commit).

Add a new migration instead (`bun run db:generate`, or a hand-written file plus
its journal entry). `scripts/check-migrations.sh` fails the `migrations` job in
QA when a pull request modifies, renames or deletes a `.sql` file that is
already on `main`.

## Populated tables

The migrator runs every pending migration in one transaction. That means
`CREATE INDEX CONCURRENTLY` fails, and a plain `CREATE INDEX`,
`ADD CONSTRAINT ... UNIQUE` or validated `FOREIGN KEY` keeps its lock until the
whole batch commits. Empty tables do not care; populated ones do.

- **Foreign keys and checks:** add with `NOT VALID` in one migration, then
  `ALTER TABLE ... VALIDATE CONSTRAINT ...` in a later one. Validation only
  takes a light lock.
- **Indexes on large tables:** run `CREATE INDEX CONCURRENTLY IF NOT EXISTS`
  by hand with `psql` outside the migrator, and make the migration
  `CREATE INDEX IF NOT EXISTS` with the same name so it is a no-op there.
- **Anything else that locks:** start the migration with
  `SET LOCAL lock_timeout = '5s';` so it fails fast instead of queueing behind
  a long query and blocking every reader and writer behind it.
