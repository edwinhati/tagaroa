# Automated scenario map, 9 October 2026

Playwright now registers 31 workflow definitions across auth and admin.
The default matrix runs Chromium, WebKit and mobile Chromium: 93 registered
checks, including two intentional heap measurement skips outside desktop Chromium.
Test registration is not proof of execution; see [the current run report](exploration.md)
and [the earlier workflow report](workflow-edges-2026-10-09.md).
Virtual passkey actions run on Chromium; other projects cover the surrounding MFA workflow.

| App   | Test                                                                             | Scenario                                                                                                          |
| ----- | -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| auth  | [accessibility.e2e.ts:4](../../apps/auth/e2e/accessibility.e2e.ts#L4)            | sign-in and locked-out guidance remain accessible in both themes, on tablet and at zoom-equivalent width          |
| auth  | [domain-admission.e2e.ts:8](../../apps/auth/e2e/domain-admission.e2e.ts#L8)      | engineering requires a session and current Engineering membership                                                 |
| auth  | [sign-in.e2e.ts:59](../../apps/auth/e2e/sign-in.e2e.ts#L59)                      | an issued operator replaces the temporary password and gets handed on                                             |
| auth  | [sign-in.e2e.ts:125](../../apps/auth/e2e/sign-in.e2e.ts#L125)                    | the sign-in form focuses errors and keeps password reveal in place                                                |
| auth  | [sign-in.e2e.ts:148](../../apps/auth/e2e/sign-in.e2e.ts#L148)                    | failed and unreachable sign-in requests allow retry without losing input                                          |
| auth  | [sign-in.e2e.ts:168](../../apps/auth/e2e/sign-in.e2e.ts#L168)                    | offline and hung sign-in requests recover without losing credentials                                              |
| auth  | [sign-in.e2e.ts:198](../../apps/auth/e2e/sign-in.e2e.ts#L198)                    | locked-out reasons and narrow layouts keep sign-in reachable                                                      |
| auth  | [sign-in.e2e.ts:222](../../apps/auth/e2e/sign-in.e2e.ts#L222)                    | signing in replaces a revoked session cookie                                                                      |
| auth  | [sign-in.e2e.ts:260](../../apps/auth/e2e/sign-in.e2e.ts#L260)                    | authenticator enrollment, recovery codes, trusted devices, and passkeys work                                      |
| admin | [identity-access.e2e.ts:56](../../apps/admin/e2e/identity-access.e2e.ts#L56)     | account settings end one session and all other sessions while retaining this device                               |
| admin | [identity-access.e2e.ts:148](../../apps/admin/e2e/identity-access.e2e.ts#L148)   | remaining account profile and sessions recover from failed reads                                                  |
| admin | [identity-access.e2e.ts:231](../../apps/admin/e2e/identity-access.e2e.ts#L231)   | remaining emergency reads retry and a stale open dialog requires reauthentication                                 |
| admin | [identity-access.e2e.ts:385](../../apps/admin/e2e/identity-access.e2e.ts#L385)   | remaining repeated SPA navigation keeps the session and reports browser heap usage                                |
| admin | [identity-access.e2e.ts:420](../../apps/admin/e2e/identity-access.e2e.ts#L420)   | remaining identity role affordances match the operator permissions                                                |
| admin | [identity-access.e2e.ts:546](../../apps/admin/e2e/identity-access.e2e.ts#L546)   | remaining identity role and position workflows persist through reload                                             |
| admin | [identity-access.e2e.ts:652](../../apps/admin/e2e/identity-access.e2e.ts#L652)   | remaining emergency access is visible and can be ended from another tab                                           |
| admin | [identity-access.e2e.ts:754](../../apps/admin/e2e/identity-access.e2e.ts#L754)   | delivery reads retry, filters survive reload and message details exclude credentials                              |
| admin | [identity-access.e2e.ts:821](../../apps/admin/e2e/identity-access.e2e.ts#L821)   | suppression search survives reload, cancellation and failed lifting before retry                                  |
| admin | [identity-access.e2e.ts:893](../../apps/admin/e2e/identity-access.e2e.ts#L893)   | subsidiary and team creation retain drafts after failure and persist after reload                                 |
| admin | [identity-access.e2e.ts:961](../../apps/admin/e2e/identity-access.e2e.ts#L961)   | membership, scoped assignment, emergency access, impersonation and deletion work through the UI                   |
| admin | [identity-access.e2e.ts:1212](../../apps/admin/e2e/identity-access.e2e.ts#L1212) | a super administrator creates, edits and archives a business role with keyboard-accessible dialogs                |
| admin | [identity-access.e2e.ts:1277](../../apps/admin/e2e/identity-access.e2e.ts#L1277) | administration pages pass accessibility checks in both themes and reflow on tablet and a zoom-equivalent viewport |
| admin | [identity-access.e2e.ts:1356](../../apps/admin/e2e/identity-access.e2e.ts#L1356) | an operator can move from the work queue to a route-backed person                                                 |
| admin | [identity-access.e2e.ts:1398](../../apps/admin/e2e/identity-access.e2e.ts#L1398) | legacy identity routes redirect to their task-based destinations                                                  |
| admin | [identity-access.e2e.ts:1426](../../apps/admin/e2e/identity-access.e2e.ts#L1426) | all administration pages load without page errors or horizontal overflow                                          |
| admin | [identity-access.e2e.ts:1460](../../apps/admin/e2e/identity-access.e2e.ts#L1460) | an administrator issues, edits, suspends, restores and reissues an account                                        |
| admin | [template-editor.e2e.ts:77](../../apps/admin/e2e/template-editor.e2e.ts#L77)     | remaining SMS and WhatsApp forms persist channel-specific wording                                                 |
| admin | [template-editor.e2e.ts:159](../../apps/admin/e2e/template-editor.e2e.ts#L159)   | remaining concurrent draft editors cannot silently overwrite newer wording                                        |
| admin | [template-editor.e2e.ts:251](../../apps/admin/e2e/template-editor.e2e.ts#L251)   | writing an email template previews it through the sending shell                                                   |
| admin | [template-editor.e2e.ts:288](../../apps/admin/e2e/template-editor.e2e.ts#L288)   | message edits survive Monaco loading                                                                              |
| admin | [template-editor.e2e.ts:333](../../apps/admin/e2e/template-editor.e2e.ts#L333)   | a draft survives a failed save, persists after reload, publishes and discards its next version                    |

## Backend and unit coverage

The 39 backend integration tests cover identity lifecycle, authorization scopes,
fresh authentication, TOTP rollover/drift, webhook signatures, atomic template
updates, queue concurrency/retries/suppression/idempotency and bounded local load.
The unit suite contains 187 tests. These complement browser flows; each browser
scenario contains multiple assertions rather than one check per interaction.

## Remaining manual/environment checks

- Physical passkeys and deployed HTTPS: explicitly deferred by the user.
- Native screen readers, physical mobile keyboards and actual browser 200% zoom:
  automated axe, keyboard and viewport reflow checks provide partial coverage.
- Firefox: local profile startup remains blocked; installed Safari/Edge/Brave were
  not exercised by this matrix.
- Real notification delivery/provider behavior and production rate limiting.
- Production capacity, hours-long sessions and sustained load beyond the local
  60-second soak; broader offline recovery and ambiguous mutation completion.
- GitHub-hosted CI execution: the workflow must run after it is pushed.
