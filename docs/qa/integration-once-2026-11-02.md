# Integration once per QA run

ISSUE-78 adds `if: matrix.project == 'chromium'` to the existing integration
step. It adds no runner, checkout, installation or database transfer. PR/push
runs keep their integration coverage; manual/weekly runs omit duplicate
browser-independent integration work. All four current browser projects remain.

## Ownership and failure propagation

Before editing, checked the open PRs and ISSUE-71/76/77 discussions. Rex owns
ISSUE-77's [PR #46](https://github.com/edwinhati/tagaroa/pull/46), which changes
only the `checks` job; this issue owns the integration condition in `workflows`.
The patches do not overlap. ISSUE-76 owns browser runtime work, and
ISSUE-42/59 retain browser failure diagnosis. This change touches neither.

The integration command, its order, and its exit handling are unchanged. A
nonzero exit fails Chromium and the matrix's `workflows` result: neither the
step nor job uses `continue-on-error`. `fail-fast: false` lets other browser
legs finish. `notify-multica`, including `needs: [checks, workflows]`, is
byte-for-byte unchanged; its `failure()` condition still sees the failed
dependency on push, dispatch and schedule. PR failures still fail QA without
sending a notification.

Auth and admin remain sequential steps in each isolated GitHub-hosted runner.
Each Playwright suite's `start:e2e` calls `prepareTestDatabase()` and
`seedE2eAdmin()` itself, so it does not depend on integration having run first.
No database is shared between runners or uploaded as an artifact.

## Invocation validation

Parsed the before/after YAML with Bun, asserted the Chromium condition was the
only workflow delta, and evaluated the actual matrix and step expressions with
each event context. The validation script is attached to the issue.

| Event             | Matrix projects                            | Integration invocations |
| ----------------- | ------------------------------------------ | ----------------------: |
| pull_request      | chromium                                   |                       1 |
| push (main)       | chromium                                   |                       1 |
| workflow_dispatch | chromium, firefox, webkit, mobile-chromium |                       1 |
| schedule          | chromium, firefox, webkit, mobile-chromium |                       1 |

These counts assume successful preceding setup, as before. Existing docs-only
path filters, cancellation and failed-job reruns retain their normal behavior.
Assertions also checked no error suppression, sequential auth/admin commands,
all four projects, and notification conditions with a failed dependency.
This is configuration validation, not an injected GitHub failure experiment.

## Whole-job cost comparison

Source: [weekly run 41283588498, attempt 1](https://github.com/edwinhati/tagaroa/actions/runs/41283588498/attempts/1).
Before durations use job `started_at`/`completed_at`, including setup,
installation, tests, artifacts and cleanup. After durations subtract only the
duplicate integration step. They are projections holding all other work fixed,
not measurements from a second run. Round each job up individually.

| Job                         | Measured before seconds | Projected after seconds | Before rounded minutes | After rounded minutes |
| --------------------------- | ----------------------: | ----------------------: | ---------------------: | --------------------: |
| checks                      |                      69 |                      69 |                      2 |                     2 |
| workflows (chromium)        |                     895 |                     895 |                     15 |                    15 |
| workflows (webkit)          |                     387 |                     299 |                      7 |                     5 |
| workflows (mobile-chromium) |                     627 |                     537 |                     11 |                     9 |
| notify-multica              |                       5 |                       5 |                      1 |                     1 |
| Total                       |                    1983 |                    1805 |                     36 |                    32 |

This sample saves 178 execution seconds (2m58s), or about 11m52s over four
equivalent weekly runs. Its projected rounded saving is four job-minutes/run,
16 over four equivalent runs. These are not billing measurements. The source
WebKit leg failed auth and skipped admin; its remaining work is held fixed,
not presented as a successful full-suite baseline. Notifications and their
failure cost remain included in both totals.

Firefox was added after this sample. Current wide runs omit three duplicates,
but there is no matched Firefox baseline here, so no measured four-browser
total is claimed. Ordinary Chromium PRs/pushes save zero. No setup overhead is
added. Real savings vary with test duration and per-job minute boundaries;
integration in Chromium still precedes both of its browser suites, so wall-clock
completion need not improve.

## Local checks

Local CI's `checks` job passed lint, types, unit tests and builds. Boundaries,
actionlint, formatting and the event-expression assertions passed separately.
After `checks` passed, stopped only this run's `workflows` runner according to
the Local CI skill's documented Docker Compose/database limitation. No local
integration or browser pass is claimed. Test source and application code are
unchanged; no authorization, assertion, skip or timeout changes are included.
