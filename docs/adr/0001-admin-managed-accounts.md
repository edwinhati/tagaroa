# 1. Admin-managed accounts

Date: 2026-08-27

## Status

Accepted

## Context

Tagaroa is an invite-only workspace. Joining the company is an HR event, so account
creation belongs to an admin instead of a public sign-up form.

Staff mail will live inside the workspace behind the same login as the rest of the product.
Emailing a recovery link to that mailbox would create a loop: the employee would need to
sign in before reading the message that restores sign-in access.

Admin-created and admin-reset passwords introduce a different risk. The employee did not
choose the password, and another person knows it. The product must replace it before the
employee can enter the workspace.

## Decision

Admins control account creation and recovery. Employees cannot self-register.

### Account creation

1. An admin creates the user through `POST /admin/create-user` with a temporary password.
2. The account-management flow sets `user.mustChangePassword`.
3. Onboarding sends the address and temporary password to the employee's personal address.
4. The employee signs in and `apps/auth` swaps the sign-in page to its password step,
   without a navigation: that page just watched the temporary password being typed, so it
   does not ask for it twice. A flagged session that returns later reopens on that step and
   asks for the temporary password.
5. Better Auth verifies the current password during `changePassword`, revokes other
   sessions, and an `after` hook clears `mustChangePassword`.

`mustChangePassword` is `input: false`, so clients cannot change it. Better Auth's
`emailAndPassword.disableSignUp` closes `/sign-up/email` with
`EMAIL_PASSWORD_SIGN_UP_DISABLED`. The product has no invitation acceptance screen or
public invitation preview endpoint.

### Password recovery

An admin sets a new password through `POST /admin/set-user-password` and delivers it using
a channel the admin and employee already trust. The account-management flow sets
`mustChangePassword`, so recovery follows the same replacement path as onboarding.

`apps/auth` does not offer reset links or send recovery email. A group-level super-admin can
restore access for a locked-out subsidiary admin.

## Consequences

- Recovery depends on admin availability and identity checks performed by people.
- The super-admin role can reset any account. Keep it rare, audit its actions, and protect it
  with 2FA when the `twoFactor` plugin is added.
- Temporary passwords travel by email during onboarding and do not expire yet. Add expiry
  before using them beyond the current internal rollout.
- Better Auth's 12-character minimum does not cover passwords set through the admin
  endpoints, so the account-management flow applies it there itself. The breached-password
  check needs no help: `haveIBeenPwned` lists both admin paths among its defaults.
- Workspace apps must reject flagged sessions. A redirect in `apps/auth` alone does not stop
  a user from opening another app directly, so the core service refuses a flagged session on
  every route outside `/api/auth`
  (`servers/core/src/modules/auth/temporary-password.interceptor.ts`).
- Adding an existing employee to another organization has no product flow. Better Auth's
  organization invitation endpoints remain available if that changes.
- Revisit email recovery if staff mail moves outside the workspace.
