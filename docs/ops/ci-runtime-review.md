# CI runtime and flake cost (ISSUE-71)

Reviewed on 2026-11-01 against main at `cb2cd319dfd6db1afc6c62f00eb83bbee1e1b294`.
Browser jobs dominate recurring hosted usage; repeated unsuccessful WebKit reruns
were the largest avoidable cost in the observed failure episode. This is a report
only. No workflows, tests, authorization code or `notify-multica` were changed.

## Scope and measurement

Read all three `.github/workflows/*.yml` files. There is no separate nightly
workflow: QA's full browser matrix is scheduled **weekly**, Sunday 01:00 UTC,
and also runs on manual dispatch. PRs and main pushes run Chromium only.
Deploy dev reacts to QA completion; Release prod polls every five minutes on a
self-hosted runner. Neither deployment workflow was executed for this review.

The primary sample is the last 20 repository-wide runs returned by `gh run list`
at approximately 16:41 UTC. It contains 10 QA runs, nine skipped Deploy dev runs
and one successful Release prod run. Three QA runs were still in progress; three
were cancelled. Completed-job statistics below exclude unfinished jobs. This is
a short, busy-day sample, not a monthly failure-rate estimate.

The latest scheduled QA run is outside those 20, so it is a separate supplemental
sample: [41283588498](https://github.com/edwinhati/tagaroa/actions/runs/41283588498),
SHA `8b48806345855cf0c89e8b9350706f1a6699e260`, nine attempts. That historical
revision predates the current notification deduplication fix (ISSUE-35).

Reproduce the data reads with:

```sh
gh run list --limit 20 --json databaseId,workflowName,event,status,conclusion,createdAt,updatedAt,headSha,headBranch,url,attempt
gh run list --workflow qa.yml --event schedule --limit 3 --json databaseId,event,status,conclusion,createdAt,url,attempt
gh api 'repos/edwinhati/tagaroa/actions/runs/<run-id>/jobs?filter=all&per_page=100'
gh run view <run-id> --log
gh api repos/edwinhati/tagaroa/actions/caches
```

Use job `completed_at - started_at`, not workflow wall time, for execution-minute
estimates; sum jobs running in parallel. Exclude skipped jobs. Rerun job lists
include carried-forward successes with new IDs but identical start/end times and
runner names: count those once by job name and start time, not once per attempt.
The supplemental job list fit in one page (45 records).

This repository is private. Hosted Linux QA jobs consume included compute usage;
self-hosted jobs do not. GitHub rounds each job up to a whole minute. All rounded
numbers here are timestamp-based estimates, not a billing export; plan balance,
other repositories and actual billed usage were not inspected. See GitHub's
[billing rules](https://docs.github.com/en/actions/concepts/billing-and-usage)
and [rounding reference](https://docs.github.com/en/billing/reference/actions-runner-pricing).

## Last 20 runs

Times are minutes:seconds. `active` means incomplete at collection, not zero cost.
The two completed checks jobs inside active runs are reported separately below.

| Run                                                                          | Workflow/event          | Result at snapshot    | checks | Chromium workflows |
| ---------------------------------------------------------------------------- | ----------------------- | --------------------- | ------ | ------------------ |
| [41327530948](https://github.com/edwinhati/tagaroa/actions/runs/41327530948) | QA / PR                 | active                | active | active             |
| [41327382880](https://github.com/edwinhati/tagaroa/actions/runs/41327382880) | QA / PR                 | active                | 1:32   | active             |
| [41326678120](https://github.com/edwinhati/tagaroa/actions/runs/41326678120) | Deploy dev              | skipped               | n/a    | n/a                |
| [41326642718](https://github.com/edwinhati/tagaroa/actions/runs/41326642718) | QA / push               | active                | 1:33   | active             |
| [41326419263](https://github.com/edwinhati/tagaroa/actions/runs/41326419263) | Deploy dev              | skipped               | n/a    | n/a                |
| [41326306519](https://github.com/edwinhati/tagaroa/actions/runs/41326306519) | Deploy dev              | skipped               | n/a    | n/a                |
| [41326302420](https://github.com/edwinhati/tagaroa/actions/runs/41326302420) | QA / push               | cancelled             | 1:26   | 3:02               |
| [41326292526](https://github.com/edwinhati/tagaroa/actions/runs/41326292526) | QA / push               | cancelled before jobs | none   | none               |
| [41326282496](https://github.com/edwinhati/tagaroa/actions/runs/41326282496) | QA / push               | cancelled             | 1:25   | 1:30               |
| [41312992999](https://github.com/edwinhati/tagaroa/actions/runs/41312992999) | Release prod / schedule | success               | n/a    | n/a                |
| [41307474219](https://github.com/edwinhati/tagaroa/actions/runs/41307474219) | Deploy dev              | skipped               | n/a    | n/a                |
| [41307431094](https://github.com/edwinhati/tagaroa/actions/runs/41307431094) | Deploy dev              | skipped               | n/a    | n/a                |
| [41306605525](https://github.com/edwinhati/tagaroa/actions/runs/41306605525) | QA / PR                 | success               | 1:21   | 10:53              |
| [41306549838](https://github.com/edwinhati/tagaroa/actions/runs/41306549838) | Deploy dev              | skipped               | n/a    | n/a                |
| [41306393845](https://github.com/edwinhati/tagaroa/actions/runs/41306393845) | QA / PR                 | success               | 1:08   | 12:56              |
| [41306114660](https://github.com/edwinhati/tagaroa/actions/runs/41306114660) | Deploy dev              | skipped               | n/a    | n/a                |
| [41305271480](https://github.com/edwinhati/tagaroa/actions/runs/41305271480) | QA / PR                 | success               | 1:31   | 15:33              |
| [41305094192](https://github.com/edwinhati/tagaroa/actions/runs/41305094192) | QA / PR                 | failure               | 1:29   | 12:23              |
| [41305013945](https://github.com/edwinhati/tagaroa/actions/runs/41305013945) | Deploy dev              | skipped               | n/a    | n/a                |
| [41304776040](https://github.com/edwinhati/tagaroa/actions/runs/41304776040) | Deploy dev              | skipped               | n/a    | n/a                |

The four completed PRs consumed 57:14 across checks and browser jobs, approximately
61 rounded job-minutes. Browser jobs accounted for 51:45 (90.4% of execution time)
and 53 rounded minutes; checks accounted for 5:29 and eight rounded minutes.
Their median checks duration was 1:25; median browser duration was about 12:40.
Seven successful checks jobs across the whole sample ranged from 1:08 to 1:33.

Cancellation already works: the two cancelled pushes with jobs consumed 7:23
(about 10 rounded minutes) before stopping; a third started no jobs. Retain
`cancel-in-progress: true`. The two completed checks jobs in still-active runs
add 3:05 (four rounded minutes). No total is claimed for those unfinished runs.
Skipped Deploy dev jobs consume no execution minutes. Release prod's `release`
job took 21 seconds on self-hosted infrastructure, zero hosted quota minutes.
The primary-sample notification jobs were skipped or cancelled without a useful
positive-duration measurement; no change to that job is proposed.

### Which steps dominate

The same four completed PR runs, seconds per step, including startup and retries:

| Step                                          |   Range | Median |   Sum |
| --------------------------------------------- | ------: | -----: | ----: |
| checks: Bun install                           |     5–7 |    6.5 |    25 |
| checks: lint                                  |     0–2 |    1.5 |     5 |
| checks: types                                 |   19–31 |   25.5 |   101 |
| checks: unit tests                            |   20–21 |     21 |    83 |
| checks: build                                 |   15–24 |     21 |    81 |
| workflows: Bun install                        |     5–7 |    5.5 |    23 |
| workflows: Chromium install + OS dependencies |   19–32 |   25.5 |   102 |
| workflows: integration tests                  |   90–93 |   91.5 |   366 |
| workflows: auth browser suite                 | 113–175 |    132 |   552 |
| workflows: admin browser suite                | 416–625 |    491 | 2,023 |

Admin alone is about 65% of browser-job execution. Splitting jobs or increasing
workers may lower wall time without lowering total minutes; admin already uses
one CI worker because its four Vite servers contend for resources. Preserve
sequential auth/admin execution and seeded-operator isolation.

## Cache hit rates

Inspected 20 distinct completed job logs: eight checks/browser logs from the four
completed PR runs, plus 12 weekly logs (checks, Chromium, mobile Chromium and nine
actual WebKit executions). Carried-forward jobs and notification logs are excluded.

| Cache                              | Observed result                     | Meaning                                                                                                        |
| ---------------------------------- | ----------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| setup-bun executable cache         | 20/20 hits, 100%                    | Logs say `Cache hit for: bun-…`; this restores Bun itself, not installed packages.                             |
| Turbo types / unit / build         | 0/105 task executions, 0%           | Five checks logs each report 0/9 types, 0/7 tests and 0/5 builds; remote caching disabled.                     |
| Bun package download cache         | not configured / no hit denominator | No explicit package-cache restore/save in QA; `bun install` still takes only 5–7 seconds in the completed PRs. |
| Playwright browser cache           | not configured / no hit denominator | Browser and OS dependency installation runs each time.                                                         |
| integration / browser result cache | intentionally disabled              | `turbo.json` sets `cache: false` for both; live database/browser results must not be reused.                   |

The cache inventory returned two entries, both with the Bun executable key. A
current inventory is not historical hit-rate telemetry; the rates above come
from logs. Do not describe absent caches as a measured 0% hit rate. A persistent
Turbo cache is worth benchmarking; adding a package cache to save at most a few
seconds may lose to transfer overhead. Playwright itself
[discourages browser caching](https://playwright.dev/docs/ci#caching-browsers)
because restore cost can match download cost and Linux OS dependencies remain.

## Retries and flakes

All primary-sample QA runs were attempt 1. Whole-run reruns and Playwright's
single configured test retry are separate costs. In the four completed PRs:

- `41305271480` passed with one auth flake: `domain-admission.e2e.ts:8`, engineering
  session/current-membership flow. Auth took 175 seconds including retry.
- `41305094192` failed admin's business-role dialog accessibility test at
  `identity-access.e2e.ts:1214`, with Axe `color-contrast` on both attempts. Its
  480-second admin step is a repeated assertion failure, not proof of a harmless flake.
- The other two completed PR logs reported no flakes. Thus one of four completed
  runs reported a recovered test, and one failed after retry. These denominators
  are small and exclude active/cancelled runs, so they are not fleet-wide rates.

The weekly run failed WebKit on **all nine attempts**. Chromium (14:55), mobile
Chromium (10:27) and checks (1:09) succeeded once and were carried forward.
Initial integration steps were 88, 88 and 90 seconds across the three browsers.
The notification step ran nine times historically, 4–5 seconds each (nine rounded
minutes); ISSUE-35 already addresses the duplicate notification chain.

| WebKit attempt | Job timestamp span | Sum of step spans | Outcome                                 |
| -------------- | -----------------: | ----------------: | --------------------------------------- |
| 1              |               6:27 |              6:25 | auth failed; admin skipped              |
| 2              |              78:49 |             18:46 | auth recovered on retry; admin failed   |
| 3              |              15:59 |             15:57 | admin failed; one recovered admin flake |
| 4              |              14:17 |             14:14 | admin failed                            |
| 5              |               7:05 |              7:02 | auth failed; admin skipped              |
| 6              |              18:42 |             18:40 | admin failed                            |
| 7              |               6:33 |              6:30 | auth failed; admin skipped              |
| 8              |              17:48 |             17:45 | admin failed; one recovered admin flake |
| 9              |               6:55 |              6:52 | auth failed; admin skipped              |

Attempt 2 has an anomalous roughly one-hour gap after its last test/artifact
activity: logs finish around 08:00 UTC but the job API says 09:00. Step and log
activity supports about 19 minutes, not 79 minutes of work. Do not treat that gap
as test runtime or promise it as savings. The eight extra attempts represent
about **106 execution minutes / 109 rounded minutes using active step spans**;
raw job spans imply 166 / 169. Actual charged minutes require billing data.
Across all nine WebKit attempts, step spans total about 112 minutes.

Logs show auth's 60-second authenticator/recovery timeout (attempts 1, 5, 7, 9),
admin hydration mismatches and business-role contrast failures (attempt 2), and
further hydration/contrast failures (attempt 8). Test lines refer to that run's
historical SHA. These are mixed persistent failures and recovered flakes, not
evidence that rerunning unchanged code will fix them. Existing ISSUE-42 and
ISSUE-59 own diagnosis; ISSUE-59 already limits the post-fix remote rerun to one.

## Recommendations ranked by minutes saved

Recurring estimates use an illustrative workload of **100 Chromium-only QA runs
plus four three-browser runs** (104 checks jobs, 112 browser jobs). They are
targets or arithmetic upper bounds, not measured improvements or a forecast of
actual monthly traffic. Rounded savings must be verified per job, after overhead.

| Rank | Concrete next action                                                                                                                                                                                                     | Estimated execution minutes saved                                                                                      | Tracking     |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- | ------------ |
| 1    | Profile admin setup/test durations on Linux; remove repeated startup/compilation work while preserving isolation and one CI worker. Require a measured 120–240-second reduction per browser job before claiming success. | Target 224–448 per illustrative workload; achievement unverified.                                                      | New ISSUE-76 |
| 2    | Persist `.turbo` for checks with toolchain-scoped keys and compatible restore prefixes; let task input hashes invalidate changed work. Benchmark warm runs including restore/save overhead.                              | Target 20–40 seconds/checks job, 35–69 per workload; 0–1 rounded minute/job depending on crossing the minute boundary. | New ISSUE-77 |
| 3    | Run integration once per QA run in the Chromium matrix leg instead of all three; retain every browser suite and failure propagation. Avoid a new standalone job's install/setup cost.                                    | Measured duplication: about 178 seconds per wide run, about 12 per workload; zero saving on ordinary PRs.              | New ISSUE-78 |

An immediate operational priority sits alongside that recurring ranking: complete
ISSUE-59/ISSUE-42 and stop blind reruns of the same SHA. Avoiding the eight extra
WebKit attempts would have avoided about 106 active minutes in this episode,
but future savings depend on recurrence. Reuse those existing issues rather than
create duplicate bug reports. Keep ISSUE-35's notification fix intact.

Do not remove main-push QA, weekly browsers, Axe checks, retries or security
assertions to reduce cost. Do not move untrusted PRs onto the deployment runner.
Release polling may consume self-hosted CPU but is not the hosted-quota target.
No extra follow-up is warranted for package/browser caching without a net-saving
benchmark; the larger costs above come first.

## Validation and limits

Ran the issue-required `bunx run-local-ci run --quiet -w .github/workflows/qa.yml
--pause-on-failure` on this checkout. `local-ci-37-j1` passed checks: lint, types,
unit tests and build. The workflows runner paused at integration because the
local-ci image lacks usable Docker Compose, the expected limitation documented
in the local-ci skill. It was aborted after checks passed, as that skill directs.
This is a passed checks gate, not a claim that local integration or browser tests
passed. No host integration/browser suite was needed for a documentation-only diff.

Remote workflows were inspected read-only; no reruns or deployments were triggered.
Unverified: active-run final results, billing-export totals, the cause of the
attempt-2 timestamp gap, future cache hit rates, proposed performance improvements
and live Linux flake reproduction. Only this report is included in the PR.
