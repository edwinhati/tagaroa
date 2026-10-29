# 4. The HR record drives joiners and leavers

Date: 2026-10-26

## Status

Accepted. Amends [ADR 0001](0001-admin-managed-accounts.md) for account creation and
offboarding; recovery is unchanged.

## Context

ADR 0001 made account creation an administrator's act because joining the company is an HR
event and there was no system recording it. The group now runs Frappe HR (v16) as the
employee record of truth, across several subsidiaries. Keeping a second, hand-maintained
account list in step with it is the access-review finding that recurs everywhere: a leaver
whose account outlives their contract because nobody told the administrator.

Two directions differ in risk. Issuing an ordinary account to someone HR has just hired, and
suspending one on the day HR says they left, both narrow the gap between the record and
reality. Restoring a suspended account, or granting anything beyond an ordinary account,
widens access and was only ever safe as a deliberate decision by a person.

## Decision

`servers/core`'s `hr` module keeps accounts in step with Frappe HR, in the two narrowing
directions only.

- **Join.** An Employee with status `Active`, a company email and a personal email, and no
  account, is issued one through the same `POST /admin/create-user` route an administrator
  uses — temporary password, `mustChangePassword`, onboarding email to the personal address,
  `emailVerified` — with role `user` and nothing else. No subsidiary, team, role or business
  grant follows from HR.
- **Leave.** An Employee with status `Left` is offboarded once its relieving date has come
  (UTC), through the same transaction as the administrator's offboard: suspended, sessions,
  memberships and business grants removed, the last active super-admin protected.
- **Never automatic.** An account suspended here and shown `Active` in HR stays suspended.
  `Inactive` and `Suspended` in HR change nothing. A deleted HR record changes nothing.

An account belongs to an HR record through `hr.employee_account`, keyed by Frappe's employee
id, not by address, so an email change in HR does not detach anyone. An account that already
holds the company email is adopted on first sight — that is how accounts issued by hand
before HR are taken over — unless it is linked to another record, which is logged rather than
guessed at.

Frappe's webhook only names the employee. It is verified against `FRAPPE_WEBHOOK_SECRET`
(`X-Frappe-Webhook-Signature`, base64 HMAC-SHA256 of the body) and the record is then re-read
through the REST API with a read-only API user, so a replayed or forged request can only
cause a re-read. An hourly pass, plus one at startup, catches missed webhooks and relieving
dates that have arrived.

Every act is audited with no actor and the HR record as its source.

## Consequences

- An administrator still issues accounts for anyone not in HR — contractors, service
  accounts — and still grants every subsidiary, team and business role.
- The quality of the HR record becomes an access control. Whoever can set an Employee to
  `Active` with a company email can cause an ordinary account to be issued; restrict that in
  Frappe to people operations.
- Transfers are not handled: a person who changes department keeps their teams here until an
  administrator moves them. Mapping Frappe's company and department onto subsidiaries and
  teams is the next step, and needs a decided mapping first.
- A relieving date applies by UTC day, up to a day early or late far from UTC.
- The hourly pass takes a Postgres advisory lock, so only one core replica reconciles at a
  time. Webhooks for one person are serialised within a process; two replicas receiving the
  same webhook at once can still race, and the loser fails on the taken address and is
  corrected by the next pass.
- With the four `FRAPPE_*` settings unset the module is inert and ADR 0001's manual flow is
  the only one. Setup: [Connecting Frappe HR](../security/frappe-hr-setup.md).
