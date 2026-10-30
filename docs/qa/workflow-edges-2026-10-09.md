# Workflow edges and cleanup, 9 October 2026

## Changes

- Authentication clients now abort stalled HTTP requests after 20 seconds.
  Personal profile reads have the same bound. Existing error states allow retry.
  A timeout does not establish whether a server mutation committed; check the
  resulting state before repeating a sensitive action.
- Account settings passes targeted lint without errors or warnings. Compact
  avatar/tab styling lives in the hand-owned Tagaroa CSS with a scoped attribute.
  Controls use their shared motion treatment. Conditional state updates replace
  effect-driven prop synchronization and reopening resets.
- Recovery-code guidance explains where to replace codes if users leave before
  saving them. Codes are not persisted in browser storage.
- Reauthentication guidance tells users to retry the action after confirmation;
  it no longer promises that an unsaved dialog draft survives navigation.

## Regressions added or expanded

| Scenario                            | Assertions                                                                                                                                                                 |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TOTP boundaries                     | Real auth API accepts adjacent windows immediately before/at a 30-second rollover and rejects two-window drift; restores the mocked clock afterward.                       |
| Reload before saving recovery codes | Verified enrollment survives reload, MFA stays enabled, and the issued recovery codes still work in the later sign-in flow.                                                |
| Emergency reauthentication          | Real MFA enrollment; stale grant denied without creation; password and TOTP confirmation; return to admin, resubmit, verify grant, end it and restore fixtures.            |
| Offline/hung sign-in                | Offline failure and stalled transport return controls to a retryable state; credentials remain; subsequent live request receives the expected invalid-credential response. |
| Account settings cleanup            | Existing profile/session retry and light/dark dialog accessibility scenarios retained for rerun.                                                                           |

The shared test TOTP generator matches six RFC 6238 vectors. This verifies the
generator, not the server's acceptance policy. Browser test discovery succeeds
for twelve selected project checks. Discovery is not execution.

## Better Auth test-utils review

The integration fixtures already use a separate `betterAuth` instance with
`testUtils()`, factories, persistence helpers and `ctx.test.login`. Production
authentication does not install that plugin. Credential, issuance and MFA
workflow checks still use real endpoints. The documented OTP capture mechanism
captures generated email/SMS verification codes; it does not supply TOTP clock
boundary tests. See the [official test-utils documentation](https://better-auth.com/docs/plugins/test-utils).

## Validation after full access

- Repository lint passes. Removed unused imports and redundant button motion;
  skeleton styling now uses scoped data attributes instead of unknown classes.
- Nine type-check tasks, seven unit-test tasks (**187 tests**) and all five
  production build tasks pass.
- Backend integration: **39 passed, 0 failed, 1,276 assertions**. TOTP boundary
  rejection asserts `401 INVALID_CODE`. Suppression fixtures explicitly mark
  messages due instead of depending on timestamp precision; all five queue
  tests also passed separately.
- Focused browser runs: **6 auth checks and 9 admin checks passed**, across
  Chromium, WebKit and mobile Chromium. These include reload after verified MFA
  enrollment, offline/stalled sign-in, complete emergency reauthentication,
  account-settings retry/axe and all-route accessibility/reflow checks.
- Removed a leftover `ALTER ROLE temporal` from Docker database initialization.
  A disposable fresh PostgreSQL container successfully created the Tagaroa
  database and became ready; the owned container and volume were removed.
- Ego TaskSpace 9 worked after access was restored; a live invalid-credential
  sign-in displayed its error and the task space was finished.
- Full auth matrix: **27 passed**, no flaky tests or retries. Full admin matrix: **52 passed, two intentional
  heap-instrumentation skips**, no flaky tests or retries.

## Development diagnostics

Impeccable Live's injected `live.js` emits a failed pending-count fetch warning
in this working tree. The user’s active Live injection was preserved. WebKit
also emits `Load failed` and `Importing a module script failed` during navigation;
These were unresolved in the first rerun; the follow-up below records the later
fixes and verification. Captured stacks identify TanStack Form’s submit
rethrow (`@tanstack_react-form.js:1711`) and the workspace virtual development
entry (`virtual:tanstack-start-dev-client-entry:6`), without establishing the
failed request’s cause. Auth scenarios attach console/error diagnostics.
The sign-in form performed a cookie check after its callback could navigate.
That check now occurs before navigation, with a regression assertion for
unhandled form rejections. The final auth matrix passed **27/27**, with no
retries or flaky results and no recorded TanStack Form rejection. The separate
virtual development-entry import error still reproduced at that point. The admin template
editor also reproduced `ResizeObserver loop completed with undelivered
notifications`; its root cause remains unresolved. No global console-error
suppression was added. Passing workflow assertions do
not establish a warning-free development console.

## CI and coverage

[Scenario map](scenario-map-2026-10-09.md) links all 27 browser scenario definitions
and records manual/environment gaps. The new `.github/workflows/qa.yml` runs
lint/types/units/build, backend integration and Chromium browser workflows on PRs;
nightly/manual runs also include WebKit and mobile Chromium. Auth and admin run
sequentially per runner. Failure traces are retained as artifacts. Bun’s YAML
parser validated both jobs and the PR trigger. Hosted execution remains pending
until the workflow is pushed; actionlint was unavailable locally.

Evidence: `/tmp/tagaroa-full-integration-final.log`, `/tmp/tagaroa-final-types.log`,
`/tmp/tagaroa-final-units.log`, `/tmp/tagaroa-final-build.log`,
`/tmp/tagaroa-final-lint.log`, `/tmp/tagaroa-queue-recheck.log`,
`/tmp/tagaroa-edge-auth-live.log`, `/tmp/tagaroa-edge-admin-verified.log`,
`/tmp/tagaroa-auth-full-live.log`, `/tmp/tagaroa-auth-full-report.json`,
`/tmp/tagaroa-admin-full-live.log`, `/tmp/tagaroa-admin-full-report.json`,
`/tmp/tagaroa-auth-final-live.log` and `/tmp/tagaroa-auth-final-report.json`.

Physical passkeys and deployed HTTPS remain deferred as requested. Automated
axe/reflow checks are partial accessibility evidence; native screen readers,
actual 200% zoom and production capacity/provider checks remain outside this run.

## Final browser result

**79 passed, two intentional skips, zero failed or flaky tests** across Chromium,
WebKit and mobile Chromium. This combines the full admin matrix and the final
auth matrix after the cookie-check fix. It does not mean every possible scenario
or every development warning has been resolved.

## Development-warning follow-up

### ResizeObserver

Native window-error capture exposed two failures in a repeated 30-check template
baseline, despite the earlier workflows passing. Observer tracing identified Base
UI toast content immediately before the error. Its percentage height followed the
parent height that Base UI recalculated from the content, creating feedback.
A scoped `[data-slot="toast-content"] { height: auto; }` override in Tagaroa CSS
lets content use its intrinsic height. Generated UI component source is unchanged.
The speculative Monaco scheduling change was reverted after it failed to remove
the warning. Temporary observer monkey-patching was removed.

The same **30 repeated template checks passed** after the toast CSS fix, across
Chromium, WebKit and mobile Chromium, with **zero captured browser/window errors**
and no retries or flaky results. Monaco checks now verify retained text and editor
width across 1100, 768 and 384 pixel viewports. Error capture survives reloads and
includes frames in the test context.

### Module imports

Failed-request diagnostics identified cancelled workspace virtual entry/style
requests during rapid navigation. The MFA test now opens the account menu and
verifies it is interactive before signing out and navigating away. The initial
auth accessibility page similarly verifies a password-reveal interaction before
starting its route sweep. Assertions reject module-import errors without filtering
or suppressing them. Six repeated MFA checks passed without recorded import errors
or cancelled workspace virtual-entry requests. Full auth verification passed **27/27**, with no retries or flaky tests.
No module-import error was recorded in its browser diagnostics or server log.
This follow-up verified 27 full auth checks plus 30 repeated template checks;
the complete identity/admin suite and backend integration were not rerun here.

Lint, nine type-check tasks and five build tasks passed. The active Impeccable Live
pending-count warning remains separate; its working-tree injection was preserved.
Hosted CI, physical passkeys, deployed HTTPS and native accessibility remain deferred.

Evidence: `/tmp/tagaroa-warning-template-matrix.json` and `.log`,
`/tmp/tagaroa-observer-trace.json` and `.log`, `/tmp/tagaroa-toast-fixed-matrix.json`
and `.log`, `/tmp/tagaroa-module-navigation-final.json` and `.log`,
`/tmp/tagaroa-warning-auth-full.json` and `.log`, `/tmp/tagaroa-warning-lint.log`,
`/tmp/tagaroa-warning-types.log` and `/tmp/tagaroa-warning-build.log`.
