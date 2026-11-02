# 1. Admin-managed accounts

Date: 2026-08-27
Amended: 2026-10-21. Current expiry, MFA, recovery and review procedures are recorded below.
Amended: 2026-10-26. When Frappe HR is configured, it drives joiners and leavers; see
[ADR 0004](0004-hr-record-drives-joiners-and-leavers.md).

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

1. An admin creates the user through `POST /admin/create-user` with a temporary password and
   the employee's personal address.
2. The account-management flow sets `user.mustChangePassword`.
3. Onboarding sends the workspace address and temporary password to that personal address.
4. The employee signs in and `apps/auth` swaps the sign-in page to its password step,
   without a navigation: that page just watched the temporary password being typed, so it
   does not ask for it twice. A flagged session that returns later reopens on that step and
   asks for the temporary password.
5. Better Auth verifies the current password during `changePassword`, revokes other
   sessions, and an `after` hook clears `mustChangePassword`.

The personal address is `user.personalEmail`, a Better Auth additional field that is
`input: true` — an admin is exactly who should set it — and `returned: false`, so it appears
in no response on any route. An admin acting on one person reads it through
`GET /api/directory/users/:userId/personal-email`; an admin scanning the roster never holds
anybody's. It is required to issue an account at all: a fallback to the workspace address
would silently restore the loop this decision exists to break, and would do it invisibly on
the day staff mail ships.

`mustChangePassword` is `input: false`, so clients cannot change it. Better Auth's
`emailAndPassword.disableSignUp` closes `/sign-up/email` with
`EMAIL_PASSWORD_SIGN_UP_DISABLED`. The product has no invitation acceptance screen or
public invitation preview endpoint.

### Password recovery

An admin sets a new password through `POST /admin/set-user-password`, from the person's `⋯`
menu in `apps/admin`. The same act revokes every session they hold: a reissue means either a
lockout or a compromise, and leaving `mustChangePassword` plus
`TemporaryPasswordInterceptor` as the only thing between a stolen session and the workspace
stakes access control on one interceptor being right. The account-management flow sets
`mustChangePassword`, so recovery follows the same replacement path as onboarding.

The new password is sent to the personal address on file, and delivered by hand when there
is none — which is every account issued before this field existed. Either way the admin is
told which of the two happened rather than a fixed sentence: `create-user` and
`set-user-password` carry the enqueue outcome back on their response, because the admin who
still has the password on screen is the only person who can rescue a message that was never
queued.

`apps/auth` does not offer reset links or send recovery email. A group-level super-admin can
restore access for a locked-out subsidiary admin.

## Consequences

- Recovery depends on admin availability and identity checks performed by people.
- The super-admin role can reset any account. Keep it rare, audit its actions, and protect it
  with mandatory MFA enrollment. Privileged recovery, impersonation and account deletion
  require a session created within 15 minutes.
- Temporary passwords travel by email during onboarding, expire after 24 hours, and must
  be replaced before business access.
- A temporary password is a live credential, so it is never written into the notification
  log an admin can read: `password` is a **secret** on the account wordings, and the code
  keeps it one even if an admin publishes a wording that leaves it out (see
  `servers/core/CONTEXT.md`).
- Better Auth's 12-character minimum does not cover passwords set through the admin
  endpoints, so the account-management flow applies it there itself. The breached-password
  check needs no help: `haveIBeenPwned` lists both admin paths among its defaults.
- Workspace apps must reject flagged sessions. A redirect in `apps/auth` alone does not stop
  a user from opening another app directly, so the core service refuses a flagged session on
  every route outside `/api/auth`
  (`servers/core/src/modules/auth/temporary-password.interceptor.ts`).
- Identity administrators add existing employees to subsidiaries and teams through the
  back office. Membership and business permission assignments remain separate.
- Revisit email recovery if staff mail moves outside the workspace.

## Operating procedure

[Identity and access operations](../security/access-operations.md) defines recovery verification,
independent privileged reviews, and join/transfer/leave responsibilities. Routine password recovery
keeps existing MFA factors. Lost-all-factors recovery requires a verified request and
independent super-admin approval through the supported back-office flow.
Weekly identity confirmations require another operator. Business grants and emergency use
are reviewed through assignments and activity with evidence retained in the restricted case.
