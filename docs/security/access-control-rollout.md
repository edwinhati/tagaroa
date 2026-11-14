# Access-control rollout and recovery checks

## Deployment order

1. Back up the database and verify restore access. Use the existing `db:migrate` command against the intended environment. The schema ships as a single migration, `0000_init`, which also seeds the account notification templates and the domain-administrator role, and installs the triggers that revoke business grants and end emergency access atomically when membership is deleted or an account is suspended.
2. Teams start without a domain link. An identity administrator links each domain team explicitly before its members can be admitted.
3. Deploy the core service, then deploy the shell, domains and admin app together. Do not rename or relink domain teams during mixed-version operation: older shells still derive admission from names. New shells fail closed if their domain-membership endpoint is unavailable.
4. Verify legacy domain links against the subsidiary/team roster. New teams remain unmapped until an identity administrator explicitly selects a domain. Renaming a linked team must preserve admission; an unrelated team named Engineering must grant nothing without a link.
5. Verify the role-specific controls with separate fixture operators. An ordinary employee cannot read group reviews, link domains, offboard accounts or request recovery. Helpdesk can request recovery but cannot approve it or offboard employees. Recovery approval requires a separate super-admin.

## Recovery exercise

Use isolated fixture accounts and a verified delivery destination. Never use a real employee's credentials for an exercise.

1. Enroll test factors and hold an old session. Request recovery with a verified case reference.
2. Confirm the requester and account holder cannot approve, and a reviewer without super-admin authority cannot approve. Reject unchecked verification, insufficient evidence, impersonated operators and stale sessions.
3. Change account security after requesting. Approval must refuse the stale evidence and expire the request so another verified request can be opened.
4. Approve a fresh request with another super-admin. Concurrent approval must produce one completion and one conflict. Verify old passwords, passkeys, TOTP/recovery codes, trusted-device records and sessions no longer work.
5. Verify the employee receives a 24-hour temporary password, must replace it, and must enroll MFA again before privileged operations. If delivery is suppressed or fails, the approver receives the one-time password for a separately verified handover. It is never included in recovery rows, audit details or permanent message payloads.
6. Verify offboarding twice produces the same state: suspended account, ordinary identity role, no sessions or memberships, revoked business grants and ended emergency access. Account and audit evidence remain.
7. Verify removing then restoring a team membership does not revive a previous grant. Test subsidiary-wide grants separately: they intentionally reach child teams until revoked or subsidiary membership ends.

## Rollback

Prefer rolling back application code while retaining the additive schema and recorded evidence. Do not drop recovery/review tables, delete domain links or restore revoked grants as a shortcut. Revocations are security decisions, not migration damage.

Older name-based shells do not enforce explicit bindings. A coordinated application rollback therefore requires pausing domain-team changes and checking each legacy name against the intended binding before restoring older clients. If that cannot be verified, keep the affected applications unavailable while restoring the compatible release. Restoring availability must not silently broaden admission.

If a database restore is required, first suspend access, preserve post-backup audit/review evidence, and reconcile grants and departures against the restored state before admitting users. Never restore a departed employee's access merely because the backup predates offboarding.

## Production responsibilities

The application enforces operator authority and independent approval; people still verify the identity evidence. Assign named primary and backup helpdesk, identity-admin and review operators, and at least two separately controlled MFA-protected super-admin accounts. The account holder cannot request their own factor reset, so maintain a separate helpdesk/operator who can initiate a case for a locked-out super-admin.

No HR system currently exists, so an external HR integration is deliberately deferred. The current directory and authorized admin workflows are the source of truth. Select a system and validate its employee identifiers, effective dates, authentication and reconciliation rules before connecting it; do not provision accounts from an unverified feed.

## Production configuration gate

Before starting a production core process, configure `BETTER_AUTH_URL` with HTTPS, `TRUSTED_ORIGINS` with exact HTTPS browser origins, and `PASSKEY_ORIGINS` (or single-origin `PASSKEY_ORIGIN`) with explicit HTTPS origins. Set `PASSKEY_RP_ID` explicitly to the intended shared relying-party domain. Every passkey origin must also be trusted and must be the relying-party host or its subdomain. Production rejects wildcard, path and query origins. It never merges local browser origins into the single-origin shorthand.

Select the relying-party ID before enrolling production passkeys. Changing it later can require reenrollment; existing credentials cannot simply be moved to another domain. The browser also enforces WebAuthn public-suffix rules. Keep door/workspace origins in the configured lists and verify both enrollment and sign-in at their real HTTPS addresses.

### Client IP for rate limiting

Better Auth's rate limiter keys on the client IP from `X-Forwarded-For`; sign-in allows about 3 attempts per 10 seconds per IP. Requests reach core straight from Pangolin: `<base>/api` targets the core container (ISSUE-118; until then Caddy sat in between). Pangolin's Traefik appends the client it saw to the header, so core receives `<client>`, followed by any private hop. Core skips the hops listed in `AUTH_TRUSTED_PROXIES` (IPs or CIDRs, comma-separated; default the private ranges), reading right to left, and keys on the first address outside them. A value a client prepends sits left of that and is ignored.

If the proxy in front stopped adding the client, the header would hold only private hops. If core trusted nothing, it would reject a multi-hop header. Either way every client would share one bucket, and an anonymous caller could lock the whole company out of sign-in. Core logs `Rate limiting could not determine a client IP` when the header cannot be resolved. Check for that log after every proxy change.

Verify the chain on each environment before release: sign in through the public URL from a known public address, then confirm that the new row in `auth.session` has that address in `ip_address`. A private address or an empty value there means Pangolin is not forwarding the client. If Pangolin forwards a header the client supplied without appending the client itself, the address is spoofable; fix that at Pangolin, not here.

The automated migration exercise performs `pg_dump` and `pg_restore` inside the local PostgreSQL container, creates a separate restored fixture database, verifies evidence and revocation behavior, and removes both scratch databases. It does not contact a production database. Run it with `bun test ./test/integration/access-migrations.integration.ts` from `servers/core`; it is skipped when a custom `TEST_DATABASE_URL` is set.

## Read-only security preflight

Run `bun run security:preflight` from `servers/core` with the intended production environment loaded. The command validates production configuration before connecting, then uses a read-only transaction. It checks this release's migration hashes, enabled membership/suspension revocation triggers, configured recovery email and notification worker, and independent recovery operators. It does not migrate, create accounts, deploy, or send notifications. Errors omit raw connection details and credentials.

The recovery staffing check requires at least two active, MFA-enrolled super-admins plus a separate active, MFA-enrolled requester with helpdesk, admin or super-admin authority. Accounts still using temporary passwords or without verified authenticator enrollment do not count. This ensures recovery of either super-admin has both a separate requester and an approver. It does not prove that accounts are controlled by different humans; verify that separately and assign named primary/backup owners.

Exit status 0 means the automated technical checks passed. Status 1 means configuration, connectivity, permissions or a check failed. A successful check does not approve production release: record real email delivery, HTTPS enrollment/sign-in, operator ownership and a restore from the target environment's backup infrastructure before acceptance. A separate notification worker deployment must be checked with its own worker-enabled configuration and actual process health.

### Dev first release: operator onboarding

The dev deploy (`infra/dev/deploy.sh`) runs this preflight before starting core, so a fresh environment cannot pass it: the operators have to sign in and enrol MFA, which needs the app running. The gate stays as is. Break the loop by hand on the dev droplet (`tagaroa@168.144.104.237`), in `/home/tagaroa/apps`, using the `core` and `web` image refs from the failed deploy log:

1. `sh onboard.sh <core-image> <web-image> <first-super-admin-email>` migrates and starts the stack without preflight and prints that account's one-time temporary password. It refuses to run once `.release.env` exists, and records no release.
2. The first super-admin signs in, replaces the password and enrols an authenticator (verified).
3. They create a second super-admin and a separate helpdesk/admin requester in the admin app. Each operator is a different person who completes their own password change and MFA enrolment.
4. Re-run the dev deploy workflow. Preflight must pass on its own; if it does not, the next deploy stops core/web again.
