# Database review: indexes, constraints and migrations

ISSUE-73, 2026-11-02, against `main` at `cb2cd31`. Read-only: no migration was
added. Each finding worth fixing has a backlog child issue.

## Scope and method

- Migrations: `servers/core/drizzle/` holds one migration, `0000_init.sql`
  (journal entry `0000_init`), plus its snapshot.
- Queries: every Drizzle call under `servers/core/src/modules/*`, the shared
  `platform/database/collection.ts`, and the Better Auth 1.7.12 organization
  plugin paths that write `auth.member` and `auth.team_member`.
- Runner: `servers/core/src/migrate.ts` (drizzle-orm 0.45.4 `bun-sql`
  migrator) and `drizzle-kit migrate`.

Not verified: no plans were taken against a real database (`EXPLAIN` on dev or
prod), and the row counts below are inferred from how each table grows.

## Summary

| ID  | Finding                                                                                                    | Kind       | Severity | Issue    |
| --- | ---------------------------------------------------------------------------------------------------------- | ---------- | -------- | -------- |
| M1  | `0000_init.sql` edited after it was first committed; the migrator never re-checks hashes                   | Migration  | Medium   | ISSUE-87 |
| M2  | Migrator runs all pending migrations in one transaction: no `CONCURRENTLY`, long locks on populated tables | Migration  | Medium   | ISSUE-87 |
| C1  | `auth.member` has no unique `(organization_id, user_id)`; Better Auth checks then inserts                  | Constraint | Medium   | ISSUE-82 |
| C2  | Role name pre-check is case-sensitive, unique index is `lower(name)`; the clash returns 500                | Constraint | Medium   | ISSUE-83 |
| C3  | "Keep one active super-admin" is enforced by a read that two offboards can both pass                       | Constraint | Medium   | ISSUE-84 |
| D1  | `notification.message` read by `created_at` with no index; table never purged                              | Index      | Medium   | ISSUE-80 |
| D2  | `auth.session` read by `created_at` and `expires_at` with no index on each dashboard load                  | Index      | Low      | ISSUE-81 |
| U1  | Access review and assignment listing load every row ever written                                           | Unbounded  | Low      | ISSUE-85 |
| I3  | `break_glass_elevation` FK columns unindexed, scanned by the revocation triggers                           | Index      | Low      | ISSUE-86 |

## Migrations

**M1: in-place edit of an applied migration.** `0000_init.sql` was added in
`4db02eb` and changed in `574b6f0` (adds `CREATE SCHEMA "hr"`,
`hr.employee_account` and its FK) under the same journal entry. drizzle-orm's
pg migrator compares only the last applied `created_at` with each migration's
`folderMillis` (`pg-core/dialect.js`, `migrate()`); it stores a hash but never
compares it. A database that applied the earlier file skips the new objects
and `migrate` still prints "Migrations applied." I could not check whether dev
ran migrate between those commits.

**M2: no online DDL.** The same `migrate()` wraps every pending migration in a
single `session.transaction`. `CREATE INDEX CONCURRENTLY` cannot run there,
and a plain `CREATE INDEX`, `ADD CONSTRAINT ... UNIQUE` or validated
`FOREIGN KEY` holds its lock until the whole batch commits. Today's tables are
small, so the fixes below are cheap now and get more expensive with every row.
For populated tables: add FKs and checks `NOT VALID` and `VALIDATE` them in a
later migration, set `lock_timeout` in the migration, and build big indexes
outside the migrator.

`0000_init.sql` itself is safe as written: it only creates objects, seeds two
templates (`ON CONFLICT DO NOTHING`) and one system role, and runs once per
database. It cannot be re-run against a populated database, but the journal
never asks it to.

## Constraints the code assumes

**C1: one membership per person per subsidiary.** `auth.member` has indexes on
`organization_id` and `user_id` but no unique pair. Better Auth's
`addMember` calls `findMemberByEmail`, then `createMember`, with no
transaction, so concurrent adds create two rows. The trigger
`revoke_departed_subsidiary_access` revokes all assignments and elevations in
the organization when one row is deleted, so removing a duplicate leaves a
member with no business access. `auth.team_member` does not have this problem:
Better Auth writes `membership_key` (SHA-256 of team and user), which is
unique.

**C2: role names unique regardless of case.** `accessRole_name_uidx` is on
`lower(name)`, but `roleKeyOrNameExists` compares `name = $1`. "Finance" next
to "finance" passes the check, fails the insert, and nothing in core maps
`23505`, so the client gets a 500.

**C3: at least one active super-admin.** The offboard path in
`identity-operations.service.ts` locks the target row, then reads all users
with `banned = false`. Two offboards of different super-admins lock different
rows and both commit. `user.banned` is nullable, so `= false` also skips NULL
rows.

Checked and holding: the partial unique `accessAssignment_active_uidx` matches
`grantAssignment` (`scope_key = team_id ?? organization_id`);
`personPosition_user_scope_uidx`, `privilegedAccessReview_userId_idx`,
`notificationTemplate_version_idx`/`_published_idx`,
`notificationSuppression_destination_idx`, `notificationMessage_idempotency_idx`,
`team_domain` PK and `hr.employee_account` PK + unique `user_id` each match the
upsert or conflict target that relies on them. `factor_recovery` "one open
request per user" is serialised by `SELECT ... FOR UPDATE` on the user row.

## Reads without a supporting index

**D1: `notification.message`** (one row per message, jsonb payload, no
retention). The admin log defaults to `ORDER BY created_at DESC LIMIT/OFFSET`,
and each page also runs an unfiltered `count(*)` and one `GROUP BY` per facet:
four full scans per view. `tallies()` filters `created_at >= now() - 24h` and
`>= now() - N days`, which are also full scans. The dispatcher's `claimDue` and
`applyReceipt` are covered by `notificationMessage_due_idx` and
`notificationMessage_providerId_idx`.

_Resolved in ISSUE-80:_ `notificationMessage_createdAt_idx` (btree on
`created_at`) serves both the `ORDER BY created_at DESC LIMIT` page and the
24h / N-day range filters. The facet and total counts stay unfiltered scans.
Retention decision: sent, delivered and failed rows are kept forever, because
the log is the audit trail and holds the rendered body. Revisit at about 5M
rows (the point where those counts and the table size start to hurt): purge or
archive terminal rows older than a fixed age in a scheduled job, never rows
that are still queued.

**D2: `auth.session`.** `activityAt` (`expires_at > now GROUP BY user_id`) and
`listSignIns` (`ORDER BY created_at DESC LIMIT 200`) run on every admin
dashboard load. Expired sessions are only deleted when presented again, and
they double as the sign-in timeline, so the table keeps growing. The auth
schema file is generated by `bun run auth:schema`, so an index has to come from
a custom migration or Better Auth's options.

**I3: `break_glass_elevation`.** _Fixed in ISSUE-86: indexes on
`(user_id, organization_id)` and `(team_id)`._ Only `session_id` and `expires_at` are
indexed. The two revocation triggers update it by `user_id` plus
`organization_id` or `team_id` on every member delete, team-member delete and
ban, and the user, organization and team FKs cascade into it.

Low, no issue filed:

- Actor columns with `ON DELETE SET NULL` and no index (`granted_by`,
  `revoked_by`, `created_by`, `updated_by`, `reviewed_by`, `requested_by`,
  `approved_by`, `auth.invitation.inviter_id`). They only cost on a real user
  delete, and accounts are banned instead. Decision (ISSUE-86): leave them
  unindexed. Each index adds write cost to tables that change on every grant,
  review and notification, to speed a delete path that does not run in
  practice. Revisit if user deletion becomes a supported operation.
- `verification.value` is matched by deletes in recovery approval and
  offboarding, with no index. The table holds short-lived tokens only.
- `notification.suppression` `keysAmong` filters by `destination` alone while
  the unique index leads with `channel`. Three channels, and Postgres 18 can
  skip-scan the leading column.
- Search in the collection helper is `ILIKE '%q%'`, which no btree serves.
  Acceptable behind the 100-row page cap until the log is large; `pg_trgm` is
  the upgrade.
- Better Auth upstream schema: `passkey.credential_id` and `two_factor.user_id`
  are indexed but not unique, and `account (provider_id, account_id)` has no
  index. Only the credential provider is in use, and these are Better Auth's
  own lookups.

## Unbounded queries

**U1: access review and assignments.** `listAssignments` reads every
assignment ever (revoked ones are kept), all roles and permissions, and all of
`auth.member`, `auth.team_member` and `auth.user`, then filters in memory.
`AccessReviewService.list` adds every break-glass elevation and every review
decision ever recorded. `findRole(id)` loads all roles to return one.

Bounded by headcount, acceptable for now, no issue: the directory and admin
dashboard reads (`listAll` users, positions, members, team members, teams,
subsidiaries), `listRecoveries`, and the template list. Audit timeline and
sign-ins are capped at 200 (`TIMELINE_DEPTH`), and the collection helper caps
pages at 100.
