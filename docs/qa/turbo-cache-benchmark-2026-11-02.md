# Persistent Turbo cache benchmark

ISSUE-77: retain persistent caching for QA's `checks` job. One cold/warm
GitHub-hosted runner pair saved approximately **73 seconds net** on unchanged
inputs, including cache restore and save overhead. This is one observation,
not a guarantee for subsequent changes.

## Measurement

Both jobs used commit `f91784b5d79e7c9ca3819d8e012eeb0e888a9edd`, Ubuntu
24.04 x64, Node v24.22.1, Bun 1.4.2 and Turbo 2.11.10. The temporary dependent
`checks-warm` job checked out the same commit on another runner and restored
the archive saved by `checks`. It was removed after the experiment.

Evidence: [cold checks](https://github.com/edwinhati/tagaroa/actions/runs/41329850450/job/124917451754)
and [warm checks](https://github.com/edwinhati/tagaroa/actions/runs/41329850450/job/124917904815).

| Step                  | Cold seconds |                Warm seconds | Warm Turbo hits / executed tasks |
| --------------------- | -----------: | --------------------------: | -------------------------------: |
| `bun run check-types` |           30 |                           0 |                          10 / 10 |
| `bun run test`        |           21 |                           1 |                            7 / 7 |
| `bun run build`       |           25 |                           0 |                            5 / 5 |
| Cache restore         |     1 (miss) |                           1 |                                  |
| Cache save            |            1 | 1 (budgeted from cold save) |                                  |

Step durations use GitHub's whole-second timestamps; zero means less than a
second. Cold Turbo hits were **0/22**, warm hits **22/22**. Turbo's internal
durations were 30.211/20.961/24.279 seconds cold and 43/44/179 milliseconds warm.
The root exploration type check still ran outside Turbo, as did root lint.

The Turbo archive was 3,631,128 bytes. The warm job did not save a duplicate
key; its projected 1-second save is charged in the comparison because normal
jobs publish unique keys. Net: `76 - 1 - 1 - 1 = 73` seconds versus executing
those commands without persistence. A cold job adds approximately 2 seconds
for the miss and initial save. Installation, lint and browser work are excluded
from this task-time comparison.

Whole jobs took 100 seconds cold and 21 seconds warm (22 with the budgeted
save). A hypothetical cold job without the cache steps would take about 98
seconds. In this pair the checks job crosses from two billed minutes to one;
future job-minute savings depend on the whole-minute boundary. If all 104 jobs
were equally warm, 73 seconds each would be 126.5 execution minutes, but that
is an extrapolation, not a measured fleet saving. The original 20–40-second
target was also a forecast. Changed inputs, toolchain/lockfile changes, eviction
and cache transfer variability reduce real savings.

## Correctness and safety

Read the installed Turbo 2.11.10 bundled `docs/README.md`, caching,
environment-variable and GitHub Actions guides before changing the workflow.

- Cache only `.turbo/cache`, containing task output archives and logs. Exclude
  dependencies, environment files, Turbo credentials and run summaries. The
  checks job receives no application secrets. Cache contents must remain public.
- Scope keys to Ubuntu 24, runner OS/architecture, actual Node/Bun versions and
  the frozen `bun.lock` hash. Save keys add run ID and attempt; restore prefixes
  never cross those compatibility fields. The warm experiment used an exact
  key; subsequent jobs use the compatible prefix. Turbo's own task hashes still
  decide reuse, regardless of archive-key matches.
- Publish only after successful checks, on main events or repository-owner PRs
  whose head repository is this repository. Fork and other contributor PRs
  restore only. GitHub additionally scopes PR caches to their merge ref.
- Existing build outputs cover all five `dist/**` directories. The warm runner
  asserted no auth/core build outputs existed before running the checks. After
  cache hits, all five directory manifests matched the cold SHA-256 manifests:
  auth 33 files, admin 102, workspace 28, engineering 23, core 282 (468 total).
- Existing Vite build environment declarations and framework inference hash
  `VITE_*`; build inputs include `.env*`. Runtime server environment is read by
  the emitted code, not embedded by `tsc`. Probes changed
  `packages/contracts/src/index.ts` and confirmed downstream build, type and test
  hashes changed, including auth build and core types. Changing
  `VITE_AUTH_BASE_URL` changed frontend hashes while leaving core build's hash
  unchanged. Restoring inputs restored original hashes. These were dry-run hash
  assertions; no probe source or environment values were committed.
- Integration and e2e tasks retain `cache: false`, run in a separate job without
  archive restore/save, and all existing checks remain. `notify-multica` is
  unchanged. No application authorization configuration changed.

Local baseline and candidate `checks` passed via Local CI, including lint,
types, unit tests and builds. `bun run boundaries`, actionlint and workflow
formatting passed. Local CI's separate integration jobs failed at the documented
runner limitation; those failures are not checks-job failures. Real GitHub cold
and warm checks both passed. The same GitHub run's integration and Chromium
browser job also passed. Browser/integration reruns are outside this cache
change's local validation scope.

To roll back, remove the restore/save steps and their setup action IDs. No
application or Turbo configuration changes need reversing. Bump `turbo-v1` to
discard the compatibility namespace if its artifact policy changes.
