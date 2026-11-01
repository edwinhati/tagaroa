# Remaining-scenario QA — 8 October 2026

This supplements `browser-fixes-2026-10-08.md`. It records actual coverage,
not a claim that every combination has been tested. Tests use the isolated
`tagaroa_test` database and ports 18080/13001/13002/13003.

Current retained evidence: **76 distinct browser checks**, **38 integration
tests / 1,265 assertions**, and **186 unit tests**. Browser evidence combines
full runs and focused reruns; this is not a claim that every scenario or every
matrix run passed without retry.

## Confirmed fixes

| Finding                                                                   | Fix                                                                              | Regression check                                                  |
| ------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Concurrent template creation could return 500 on a version collision      | Use the existing unique constraint to reject the competing insert and return 409 | Four concurrent HTTP creates                                      |
| An invalid locked-out reason could crash the page                         | Explicitly select supported reasons and fall back to password recovery guidance  | Three reasons on three browser projects; Ego inspection           |
| Mobile account settings left the sidebar drawer open behind the dialog    | Close the drawer when opening settings                                           | Mobile account security flow                                      |
| Auth routes produced a WebKit hydration error                             | Render the SPA route outlet through TanStack `ClientOnly`                        | Locked-out page error assertion and full auth matrix              |
| Admin issuance of the default Employee role was rejected as a role change | Omit the default role from the create-user request                               | Issue/edit/suspend/restore/reissue UI lifecycle on three projects |
| Impersonation audit attributed the action to the target account           | Use the existing operator session for administration audit events                | Assert the operator actor ID through the real API                 |

Two test fixture defects were also corrected: template search uses `q`, and
team member operations require an active organization. No product policy was
weakened to accommodate either fixture.

## Coverage matrix before this expansion

| Area                       | Completed checks                                                                                                                                                         | Remaining or limited coverage                                                                                           |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| Sign-in                    | Issued password replacement, validation/focus, reveal control, wrong credentials, network failure/retry, revoked-cookie replacement                                      | Production rate limiting is disabled in the test environment                                                            |
| Account restrictions       | Suspended login and existing session rejection, restore, temporary-password expiry                                                                                       | Deployed policy/configuration differences                                                                               |
| Reauthentication           | Read-only email, wrong password rejection, successful confirmation; stale privileged session rejected through API                                                        | Long-running expiry during an open sensitive dialog                                                                     |
| Authenticator MFA          | Enrollment, invalid/replayed code, trusted-device login                                                                                                                  | Abandon/reload during enrollment, clock drift, challenge and trusted-device expiry                                      |
| Recovery codes             | Usage, replacement password check, acknowledgement, old-code rejection and new-code acceptance                                                                           | Exhaustion of every recovery code                                                                                       |
| Passkeys                   | Virtual Chromium authenticator registration, list, sign-in, removal, cancelled-operation retry                                                                           | Physical devices explicitly skipped by user; WebKit virtual authenticator not exercised                                 |
| Sessions                   | Revoke other sessions while keeping current; fourth-session eviction; expired database session                                                                           | Concurrent sign-ins and long sessions                                                                                   |
| Personal profile           | Existing read-only profile surface; display-name edit, reload, validation error and failed-save retry (ISSUE-51)                                                         | Fetch failure/retry; only the display name is self-editable                                                             |
| Identity administration    | UI issue/edit/suspend/restore/reissue on three projects; impersonation/stop/deletion through HTTP; impersonation actor audit                                             | UI deletion, impersonation and privileged role changes                                                                  |
| Identity role policy       | User/helpdesk/access-reviewer/admin/super-admin directory and mutation matrix; privileged caller without MFA rejected                                                    | Every UI affordance for each identity role                                                                              |
| Scoped business access     | Subsidiary grant reaches child team; team-only grant excludes sibling; membership removal immediately denies access; revoke denies access                                | Cross-user UI admission to the engineering domain                                                                       |
| Custom roles               | Create, duplicate conflict, edit persistence, fresh-session requirement, archive and archived-edit rejection                                                             | Complete role form workflow in browser                                                                                  |
| Emergency access           | Explicit reason required; activation/use audit; expiry and manual end deny access                                                                                        | UI workflow across tabs                                                                                                 |
| Directory                  | Subsidiary/team creation, invalid slug, positions create/edit/delete, self-report and two-person reporting cycles rejected                                               | Subsidiary/team rename/delete and membership form workflows                                                             |
| Templates                  | HTTP create/edit/publish/version/delete for email/SMS/WhatsApp; concurrency; browser preview and Monaco loading; failed-save retry; reload; publish; new-version discard | Every channel's browser form and simultaneous operator edits                                                            |
| Notifications              | Signed Meta webhook accepts original bytes; modified/unsigned body rejected; unknown provider rejected                                                                   | Queue/provider retry and suppression against real persistence; external provider delivery not exercised                 |
| Accessibility              | Error focus, accessible control names, dialog dismissal; Ego keyboard order and forced-colors narrow-page structure                                                      | Full screen-reader, contrast and forced-colors visual audit                                                             |
| Responsive layout          | Auth 320px; Pixel 7 auth/admin flows; all 12 admin pages checked for overflow and page errors                                                                            | Tablet, actual 200% browser zoom and physical mobile keyboard                                                           |
| Browser compatibility      | Desktop Chromium, WebKit, mobile Chromium                                                                                                                                | Firefox launch fails before application code: `Could not find profile folder.`; installed Safari/Edge/Brave not covered |
| Production and performance | Local production build; repeated isolated browser runs                                                                                                                   | Deployed HTTPS explicitly skipped by user; sustained load, long-session memory and stress testing                       |

## Reproducible commands

Run browser suites sequentially because they share the isolated database and
seeded operator. The Firefox project remains configured; excluding it here
documents an environment failure rather than silently removing coverage.

```sh
rtk proxy bun run test:integration
rtk proxy bun run test
rtk proxy bun run check-types
rtk proxy bun run build
cd apps/auth
rtk proxy bun run test:e2e --project=chromium --project=webkit --project=mobile-chromium
cd ../admin
rtk proxy bun run test:e2e --project=chromium --project=webkit --project=mobile-chromium
```

Previous completed verification: 28 integration tests / 177 assertions; 186 unit
tests across seven workspace tasks; 18 auth browser checks; 21 admin browser
checks including the template lifecycle. The combined expanded admin suite
passed in 1.8 minutes. Nine type-check tasks and five production build
tasks passed. Targeted lint and `git diff --check` passed.

## Expanded domain, queue and accessibility checks

Additional confirmed fixes:

- Engineering now requires membership in its domain team. Direct navigation by
  another signed-in person returns to the workspace; removing membership also
  removes admission on the next navigation.
- Subsidiary membership creation uses an authorized core endpoint. The installed
  Better Auth `addMember` operation is server-only, so the former browser HTTP
  call returned 404. The endpoint accepts only the standard member role and audits
  the operator and target.
- Scrollable business and identity role catalogs are keyboard focusable and named.
  Their positioned containers keep visually hidden table headings from widening
  the document. The shared page container allows its flex content to shrink.
- Archived business roles now show their archived status in the library.

Queue tests use real database persistence and fake carriers: transient retry and
backoff, eventual success, permanent failure, attempt exhaustion, suppression
after enqueue, channel isolation, lifting suppression, idempotency, stale lock
recovery, batch draining and two concurrent workers processing 200 messages once.
No external provider deliveries were sent.

The latest integration run passed **35 tests / 1,239 assertions**, including
rejection of ordinary callers and administrators without MFA at the new member
endpoint. The bounded
local HTTP load check completed **200 requests at concurrency 10**, with p50
19.3 ms, p95 40.9 ms and maximum 45.6 ms while the browser suite was also running.
The earlier isolated run measured p95 18.0 ms. This is not a production capacity or
sustained stress measurement.

Accessibility coverage adds axe WCAG A/AA checks in light and dark themes,
tablet layout at 768×1024, 384px reflow, keyboard dialog use, forced colors and
reduced motion. Product regions are scanned; development tooling is outside
the scan. The test fixture hides the Live development toolbar because it covers
mobile controls. No accessibility rules were disabled.

**Limits:** 384px reflow is zoom-equivalent width, not native 200% browser zoom.
Native zoom shortcuts did not change the Ego viewport, and native automation
exposed another task's window, which was left alone. Full screen-reader testing,
physical mobile keyboard behavior and sustained/staging load remain unverified.
Physical passkeys and deployed HTTPS remain skipped at the user's request.

Current unit verification: **186 tests**, nine type-check tasks and five build
tasks passed. Expanded browser matrix results are recorded after their runs
complete; the previous counts above are historical.

Administration: the full run passed 28/30 checks. A six-check rerun passed the
WebKit accessibility/navigation check and all three browsers' accessibility
scans; the remaining mobile workflow then passed in a focused run (30.2 seconds).
All 30 distinct administration checks therefore have passing evidence across
the initial run and reruns, rather than one clean full-matrix run. Fixture fixes
wait for route readiness, exclude the development toolbar, and wait for normal
toast dismissal before clicking an action beneath it.

Auth/domain: the full run passed 22/24 checks, including Engineering admission
on all three browsers. The corrected keyboard/accessibility check then passed
on Chromium, WebKit and mobile Chromium (3/3 in 32.7 seconds). All **54 distinct
browser checks** have passing evidence across the full runs and targeted reruns.
The keyboard fixture waits for the form to be ready and uses Option-Tab on
macOS WebKit, as described in [Apple's keyboard guidance](https://help.apple.com/safari/mac/8.0/en.lproj/cpsh003.html).

Axe contrast checks run in the ordinary light/dark themes. An additional
forced-colors contrast scan produced mixed authored/system color values,
consistent with [axe's documented forced-colors issue](https://github.com/dequelabs/axe-core/issues/3978).
Forced-colors coverage is keyboard/visibility and the Ego visual inspection;
it is not automated contrast certification. No axe rules were disabled.

Before the next continuation, remaining administration coverage included identity-role changes through the
browser, role UI affordances, and cross-tab emergency access. Their
authorization policies have API coverage; passing the workflows above does
not establish every combination. Provider delivery, sustained load and long
session memory behavior also remain outside this local run. Development logs
contain WebKit module-load and ResizeObserver warnings; the completed workflow
assertions passed, but these warnings have not been fully diagnosed.

Scoped anti-slop review: fixes reuse the existing shell, native controls and
authorization boundaries; no new product framework, invented domain settings,
design suppressions or generated component edits were introduced. Axe is a
development dependency for reproducible regression checks.

## Further remaining-scenario checks

New browser coverage:

- Change a disposable person's identity role through Helpdesk, Access reviewer,
  Identity administrator, Super administrator and Employee; reload and verify
  persistence after every change.
- Create, edit and remove a group position through the person screen. The blank
  title cannot be saved, and titles persist across reload.
- Check the person action menu for reviewer/helpdesk/admin/super-admin callers,
  business-role creation and emergency-access visibility; Employee is redirected
  away from the back office. This covers the named core affordances, not every
  possible role/target/state combination in every screen.
- Open an existing emergency grant from another tab and end it there. Keep the
  first dialog open and verify activation/end updates without a page reload.
- Exercise 30 SPA transitions between People and Work queue while retaining the
  same performance time origin and operator session. Latest measured Chromium
  heap after forced garbage collection: 63.8 MiB before, 63.5 MiB after.

**Confirmed new bug and fix:** the emergency dialog held the grant only in local
component state, so reload or another tab lost the End control while access was
still active on the server. It now queries active grants for the authenticated
user **and session**, excludes expired/ended grants, and refreshes while open.
The dialog shows permission, scope and reason; fetch errors are announced and
activation is disabled until the session's active state is known. Multiple
active grants are returned in expiration order and can be ended one at a time.

API checks verify that even another session for the same user sees no grant and
cannot end it. Expired grants disappear from the active list. Queue regression
fixtures explicitly mark the first retry message due, avoiding a sub-millisecond
database/application timestamp boundary.

Latest integration verification: **36 tests / 1,250 assertions passed**. The
60-second local soak completed **5,460 requests, concurrency 10, zero failures,
p95 11.7 ms**. Session validity was checked throughout. Post-GC process RSS and
heap decreased in this run; this process includes the in-process service and
test runner. Neither this sample nor 30 browser transitions proves absence of
leaks or hours-long stability. Staging capacity, provider delivery and long
production sessions remain unverified.

The new-scenario matrix finished with 12 passes, two intentional heap-instrumentation
skips (WebKit/mobile) and one WebKit interruption during the older impersonation
workflow. After waiting for the actual workspace load and Home screen on return,
the final regression run passed **6/6** across Chromium, WebKit and mobile Chromium
in 1.4 minutes, including expiry in an open emergency dialog. Together with
role/position/affordance and Chromium SPA results, all **10 new distinct browser
checks** have passing evidence. Nine type-check tasks, five build tasks, targeted
lint/formatting and `git diff --check` passed. The latest focused heap measurement
was -0.3 MiB; no leak threshold was asserted.

Firefox launch was retried with both the standard temporary directory and
`/tmp`; both fail with `Could not find profile folder` before application code.
Native zoom/screen-reader automation again exposes a different task's native
window. It was left untouched. Physical passkeys and deployed HTTPS remain
skipped at the user's request.

### Focused Impeccable audit: emergency dialog

| Dimension                | Score | Evidence / limit                                                                                                              |
| ------------------------ | ----- | ----------------------------------------------------------------------------------------------------------------------------- |
| Accessibility            | 3/4   | Named native controls, announced errors, modal axe checks; manual screen reader remains outstanding                           |
| Performance              | 3/4   | Small session-specific query, polling only while open; one-second refresh adds bounded requests                               |
| Responsive design        | 3/4   | Existing dialog/control layout; mobile workflow passes; native zoom remains outstanding                                       |
| Theming                  | 3/4   | Existing semantic color and typography tokens; no new fixed colors                                                            |
| Implementation integrity | 4/4   | Server authority restored, session isolation enforced, existing query and dialog infrastructure reused; detector returns `[]` |
| Total                    | 16/20 | Good within the audited scope; not a product-wide accessibility certification                                                 |

The blocking workflow finding above is fixed. No new design suppression or
generated component changes were introduced. PRODUCT.md still contains older
domain-admission wording; no design-document rewrite was performed during QA.

## Test tooling choice

Keep reproducible regressions in the existing Playwright suites and use Ego
for exploratory testing. Playwright projects already cover browser and device
variants: https://playwright.dev/docs/test-projects.

TestSprite can be considered later for independent generated frontend/API
coverage (https://www.testsprite.com/). It is not required to retain or run
these regressions. No TestSprite account, repository upload or installation
was performed.

Existing staged changes were preserved. QA changes remain unstaged, and the
local Impeccable Live injection must not be staged.

# Recovery-code exhaustion continuation

The existing enrollment scenario was expanded and rerun on Chromium, WebKit,
and mobile Chromium: **3 passed**. These are expanded existing checks, so the
distinct browser-check count remains 64.

- All ten replacement recovery codes were consumed successfully once.
- Reuse after exhaustion was rejected. Repeated failures intentionally invalidate
  the MFA challenge after five attempts; later failures exercise that protection.
- A fresh password challenge followed by a valid authenticator code still worked
  after recovery-code exhaustion.
- The remainder of the enrollment, reauthentication, trusted-device, and supported
  virtual-passkey workflow passed in the same run.

The initial expanded fixture retained too many temporary sessions and triggered
the intended three-session limit. It now signs out each temporary session. No
product defect was confirmed by this continuation. Auth type checking, targeted
lint and formatting checks passed. Evidence: `/tmp/tagaroa-qa-exhaustion-clean.log`.

Remaining gaps include MFA abandonment/reload and timed expiry, stale sensitive
dialogs, profile fetch failures and retries, channel-specific browser forms,
concurrent template editing, and the previously documented hardware/deployment,
manual accessibility, browser-environment, and extended-load checks.

## Authentication, account recovery, and concurrent editing continuation

This continuation closes several gaps listed above. The clean selected
administration/workspace run passed **24 checks** across Chromium, WebKit and
mobile Chromium (`/tmp/tagaroa-qa-admin-clean-final.log`). Four new scenarios
per project add twelve distinct checks to the retained browser coverage.

### Product findings fixed

| Finding                                                                       | Fix and regression                                                                                                                                            |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Concurrent draft editors silently overwrote newer wording                     | Atomic `updatedAt` comparison returns 409 for stale drafts; browser checks preserve the losing editor's unsaved text.                                         |
| Fast Monaco typing could save truncated wording                               | Removed the passive value echo that overwrote newer editor input; exact SMS body, simultaneous editors, delayed editor loading, and preview regressions pass. |
| Inactive account tabs failed contrast                                         | Shared Tagaroa tab styling increases inactive text contrast; light/dark account dialog axe scans pass.                                                        |
| Sessions list contained invalid list markup                                   | Moved the list inside its settings wrapper; dialog axe scans pass.                                                                                            |
| Expired MFA challenges showed a cryptic cookie error without a restart action | Explain that verification expired and offer “Sign in again”; real expired challenge and subsequent password/MFA recovery are checked.                         |

Shared avatar radius now uses the documented 6px token value, and the one-pixel
navigation marker uses a square edge. Generated shadcn components were not edited.

### Expanded scenario coverage

- Profile and session-list 503 responses, visible failure guidance, keyboard
  retry, and successful recovery; account dialog light/dark screenshots and axe.
- Emergency grant read failures disable activation until recovery. A session
  aged while the dialog remains open receives 403, creates no grant, and reaches
  the isolated authentication confirmation page.
- SMS exact text/count/save/reload; WhatsApp invalid template-name rejection,
  retained input, valid save/reload; two simultaneous draft editors.
- Abandon unverified MFA setup and reload to a new secret; reject a five-minute-old
  TOTP; reload a challenge; age trusted-device and challenge records in the test
  database and require fresh verification. These simulate expiry without waiting
  thirty days. Existing recovery-code exhaustion and virtual passkey checks remain.
- Backend regressions cover concurrent sign-ins and draft freshness validation,
  simultaneous writes, PostgreSQL microsecond timestamps, stale writes, missing
  drafts, and strictly increasing revision timestamps.

Development tooling overlays are excluded from browser fixtures because they
are absent in production. Entrance animation readiness and workspace handoff
readiness were corrected in fixtures; no axe rule or authorization was disabled.

### Scoped design and implementation audit

The account settings, wording editor, and MFA error recovery changes were
reviewed against the existing design. Account dialog desktop/mobile screenshots
were inspected in both themes; the focused Impeccable detector returned `[]`.
No dependency or generated component modification was introduced. Manual screen
reader and native zoom checks remain outstanding, so this is a scoped review,
not a full accessibility certification.

Targeted lint passes for the changed authentication/editor/backend/test files.
The full account settings file still has pre-existing shadcn restyling errors
and React effect warnings; its semantic list fix does not resolve that broader
style debt. Repository-wide lint is not claimed clean.

### Compatibility and remaining gaps

Template PUT requests now require `expectedUpdatedAt`; the browser caller sends
the current draft timestamp. Deploy client and server together. Older callers
receive 400 rather than silently overwriting a newer draft.

Still outstanding: physical passkeys and deployed HTTPS (explicitly skipped),
real provider delivery, manual screen readers/native 200% zoom/physical mobile
keyboard, Firefox environment failure and installed Safari/Edge/Brave, production
rate limiting, hours-long sessions and production capacity tests. Fine TOTP
boundary drift, reload after successful MFA enrollment before recovery-code
acknowledgement, returning from stale admin reauthentication and resubmitting a
grant, and broader offline/hung-request combinations are not fully covered.
Development WebKit/module-load and ResizeObserver warnings remain observable.
Playwright retains these regressions; no TestSprite installation or upload occurred.

Validation after these changes: nine type-check tasks, 186 unit tests, five
production build tasks, targeted formatting/lint and `git diff --check` passed.
The full authentication run passed 23 of 24 checks before the final entrance
readiness fixture fix. The subsequent accessibility rerun passed all three
projects (`/tmp/tagaroa-qa-auth-a11y-settled.log`); no contrast rule was suppressed.
The first backend expansion passed 37 of 38 tests; its older template lifecycle
fixture needed the required timestamp and was corrected before the final run.

The final backend run passed **38/38 tests with 1,265 assertions**
(`/tmp/tagaroa-qa-integration-verified-final.log`), including concurrent sign-ins,
atomic draft edits, the full channel lifecycle, queue retries/suppression, and
the bounded local soak. No real provider delivery was performed.

The final full authentication run passed **24/24 checks**
(`/tmp/tagaroa-qa-auth-complete-final.log`). Together with the clean selected
administration/workspace run, this continuation reran **48 distinct browser
checks** successfully. The retained total of 76 includes prior passing runs;
the entire 76-check matrix was not rerun in this continuation.

Final local soak: 60 seconds, 5,070 requests at concurrency 10, zero failures,
p95 22.4ms, RSS delta +2.2 MiB and heap delta -10.1 MiB. This bounded observation
does not prove production capacity or absence of long-term leaks. Own browser
servers and Ego task space were closed; user development servers were preserved.

## Follow-up, 9 October 2026

See the [workflow-edge results](workflow-edges-2026-10-09.md) and
[scenario map](scenario-map-2026-10-09.md) for the latest 79 passing browser
checks, two intentional skips, 39 passing integration tests and remaining gaps.
