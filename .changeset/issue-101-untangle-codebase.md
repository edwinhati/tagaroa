---
"@servers/core": minor
"@apps/admin": minor
"@apps/auth": patch
"@apps/workspace": patch
"@domains/engineering": patch
"@repo/contracts": minor
"@repo/shell": minor
---

ISSUE-101: Identity roles, permissions and refusal codes now come from one shared policy, so every app shows and enforces the same rules.

- A temporary password is refused with `MUST_CHANGE_PASSWORD` (or `TEMPORARY_PASSWORD_EXPIRED`) on every route, including `/api/auth`, which used to say `PASSWORD_CHANGE_REQUIRED`.
- Passwords must be at least 12 characters in every environment.
- Confirming a privileged access review answers `{ data: { reviewed: true } }`.
- Old admin addresses such as `/overview`, `/roles`, `/security` and `notifications?tab=` no longer redirect; links point at the admin home.
- Admin asks you to sign in again whenever a change needs a recent sign-in, shows role names instead of role ids, and counts passkey sign-ins on the activity page.
- The sign-in app now loads the shared shell styles.
- The Frappe webhook refuses requests when its signing secret is empty.
