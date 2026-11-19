# @servers/core

## 0.2.3

### Patch Changes

- aa4df4e: ISSUE-135: The HR sync can read a Frappe site behind Pangolin: set `FRAPPE_ACCESS_TOKEN` to a Pangolin share-link token (`<id>.<token>`) and core sends it with every Frappe request.

## 0.2.2

### Patch Changes

- 9474582: ISSUE-137: authenticator apps and passkey managers list accounts under `AUTH_APP_NAME` (default "Tagaroa"), so dev can show up as "Tagaroa Dev" instead of looking like prod.

## 0.2.1

### Patch Changes

- e1bc6b8: ISSUE-131: The core-service image no longer ships TypeScript's native `tsc` (a peer dependency core never loads), which clears the `golang.org/x/text` finding. The remaining glibc findings have no fix in any `oven/bun` base and are explained in `docs/ops/core-image-findings.md`.
- 26cef4e: ISSUE-130: Signing out of NetBird no longer stops on Better Auth's bare "Confirm logout" page, whose Confirm always failed in production. When core can't tie the sign-out to this browser's session, it sends the person to a sign-out page in the door instead, with the app and its registered return address sealed in the link; the door signs them out and takes them back to the app.
- 27383c5: ISSUE-128: Remove code nothing used (an unused email theme file and two unused admin exports), found by knip. No change in behaviour.
- 4b99d1c: ISSUE-129: Signing out of NetBird no longer stops at "The client is not allowed to initiate logout". OAuth clients are registered with end session enabled, and `scripts/oauth-client.ts ... --logout <uri>` registers where the app may send people after they sign out (NetBird: `https://vpn.tagaroa.cc/oauth2/logout/callback`).

## 0.2.0

### Minor Changes

- d152c6c: ISSUE-126: Tagaroa is an OIDC provider, so NetBird (and later other first-party apps) can sign people in with their Tagaroa account. The issuer is `<BETTER_AUTH_URL>/api/auth`; ID tokens are RS256 and carry email and name. Someone still on a temporary password, or a privileged role without MFA, is held at the sign-in page until they finish onboarding. Clients are registered by an operator with `scripts/oauth-client.ts`, never over HTTP. Production needs the new `SIGN_IN_URL` (the door).

## 0.1.1

### Patch Changes

- 16f1af6: Core's image runs on Bun's distroless base instead of Debian slim, leaving no shell or OS packages to patch.

## 0.1.0

### Minor Changes

- f96cc63: ISSUE-101: Identity roles, permissions and refusal codes now come from one shared policy, so every app shows and enforces the same rules.

  - A temporary password is refused with `MUST_CHANGE_PASSWORD` (or `TEMPORARY_PASSWORD_EXPIRED`) on every route, including `/api/auth`, which used to say `PASSWORD_CHANGE_REQUIRED`.
  - Passwords must be at least 12 characters in every environment.
  - Confirming a privileged access review answers `{ data: { reviewed: true } }`.
  - Old admin addresses such as `/overview`, `/roles`, `/security` and `notifications?tab=` no longer redirect; links point at the admin home.
  - Admin asks you to sign in again whenever a change needs a recent sign-in, shows role names instead of role ids, and counts passkey sign-ins on the activity page.
  - The sign-in app now loads the shared shell styles.
  - The Frappe webhook refuses requests when its signing secret is empty.

### Patch Changes

- ce7e691: ISSUE-107: Core's own routes are rate-limited per client: 600 requests a minute, and 120 for the HR and message-provider webhooks. Past that a client gets a 429 with "Too many requests. Wait a minute and try again." Better Auth's routes keep their own limits, and health checks have none.

  A provider retrying a delivery receipt no longer changes anything. A message keeps the time its outcome first arrived, and a retried bounce no longer blocks an address an admin has cleared.

- a2a604b: ISSUE-118: Core refuses a request body over 10 MB with 413, and a sign-in request that does not declare its length with 411. The web proxy that enforced the limit before no longer sits in front of core.
- a5e4fbb: ISSUE-19: Access-control requests are now checked against a schema. A body that is not a JSON object returns 400 "Request body must be a JSON object." with field `details`; before, it was read as empty, so `PATCH /access-control/assignments/:id` with no body silently cleared the expiry. Valid requests behave as before.
- f2da030: ISSUE-26: `PUT /api/directory/positions/...` now validates its body with Zod. A failure is a 400 with `message` plus `details: [{ field, message }]`. A non-string `managerUserId` is now rejected instead of clearing the manager. A blank title for a person who does not exist returns 400 instead of 404.
- 871ceb3: ISSUE-27: Notification template create and edit validate their bodies with Zod. A malformed request is a 400 that lists each field's error under `details`, and a non-list `variables` or `secrets`, or a non-text `subject`, is now refused instead of ignored.
- a9d2920: ISSUE-61: Session listings no longer return session tokens, and only a signed bearer token is accepted. Only a super administrator can list or revoke a privileged account's sessions. Revoking a single session now goes through core by session id and is recorded in the audit trail.
- 1752e64: ISSUE-62: Account notification templates always mask the temporary password in the message log, even when an edited template no longer marks it secret.
- 025859f: ISSUE-63: An impersonated session can no longer record access reviews, change access-control roles, grants or break-glass, or write through Better Auth's admin and organization endpoints. Operators must use their own MFA-protected account; reads and stopping impersonation still work.
- cc4c01a: ISSUE-65: The audit trail now records notification template changes, lifted suppressions, single-session revocation, the end of impersonation, and subsidiary and team edits. Direct organization writes that bypassed the trail (invitations, member roles, team creation) are refused.
- c8b46cd: ISSUE-69: Update the editor sanitizer and HTTP parsers to address dependency security advisories.
- 4651a5d: ISSUE-82: Adding someone who is already a member of a subsidiary now answers 409, including when two requests race, and the database allows one membership per person per subsidiary.
- c88e6ec: ISSUE-83: Creating or renaming a role to a name that differs only by case now answers 409 instead of 500.
- d95cf31: ISSUE-84: Offboarding two super administrators at the same time can no longer leave none active.
- 0334a92: ISSUE-93: Remove the vulnerable deepmerge dependency from email rendering by updating React Email Render to 2.2.0, including the copy pinned by React Email Components.
- 6a2a07f: Refuse provider webhooks when their signing secret is empty or a bare `whsec_`, which previously let anyone forge a Resend, Twilio or WhatsApp receipt (and raise a suppression on any address); read settings only from the validated environment; and let a notification or HR pass already under way finish before shutdown closes the database pool, so a deploy no longer sends a message twice.
- c1ad4d4: Close account-security gaps found in review:

  - A refused password reissue no longer emails the person a "password reset" carrying the caller's text.
  - `/admin/update-user` changes only name, email, personal email and role; second-factor and temporary-password state are refused.
  - Bearer-authenticated admin and subsidiary requests now get the same policy as cookie sessions.
  - An expired temporary password is refused at sign-in and at password change, with or without a second factor, and leaves no session behind.
  - The database keeps one active super administrator when two are suspended, demoted or deleted at once.
  - An impersonated session can no longer write through any core route outside `/api/auth`.
  - Reissuing a password ends every session the person holds, on the server.
  - Impersonating someone no longer signs them out of one of their own devices.
  - A display name containing `{{word}}` no longer makes that person's email unsendable.

- 72ca3b5: ISSUE-51: People can change their own display name in Account settings. Email, role and the personal address stay admin-managed: the self-service update now refuses every other field, and each change is recorded in the identity activity trail.
- 6a2a07f: Validate request bodies and queries with Nest's built-in Standard Schema pipe instead of a hand-written one. Error responses are unchanged; `__proto__`, `prototype` and `constructor` keys are now stripped from a request before it is parsed.
- 699b33c: ISSUE-25: Auth-management requests (factor recovery request and approval, offboarding, and creating subsidiaries, teams and members) now validate their bodies with Zod. Valid requests are unchanged; an invalid body returns the standard 400 with `message` and `details: [{ field, message }]`.
- 6bc028d: ISSUE-50: The Frappe HR and notification (Resend, Twilio, Meta) webhooks now validate their payloads with Zod after the signature check. Valid and ignored events are unchanged; a signed payload missing or mistyping a field the receipt parsers read returns the standard 400 with `message` and `details`. Unsigned or altered bodies are still a 401, before any parsing.
