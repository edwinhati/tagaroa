# QA runner (sandboxed, self-hosted)

QA on GitHub's hosted runners costs about 17 minutes per run against the free plan's
2,000 a month, and that budget ran out on 2026-11-04. Self-hosted jobs cost no
minutes. This runner takes QA off the hosted quota without putting pull request code
anywhere near the deploy runner.

Context and machine details: `../NOTES.md`. The deploy runner is in `deploy-dev.md`.

## What makes it safe for pull request code

Pull requests (written by agents included) run arbitrary code here. The deploy
runner on CT 105 can never take them: its Docker socket is root on the host and its
jobs carry `PROD_SSH_KEY`. This runner is the opposite:

- **No Docker socket and no host directories.** Tests get Postgres from a sidecar
  (`postgres:18-alpine`, data on tmpfs) that shares the runner's network, so
  `127.0.0.1:5432` works exactly as on a laptop. `TAGAROA_TEST_POSTGRES=external`
  tells `servers/core/test/database.ts` not to call `docker compose`.
- **No secrets.** QA's `checks` and `workflows` jobs use none.
- **No sudo**, `no-new-privileges`, CPU, memory and process limits.
- **Its own label**, `tagaroa-qa`. It must never carry `tagaroa`, or deploy jobs
  could be scheduled onto it.

Residual risk: the runner is persistent, so one job can leave files behind for the
next (in `/home/runner` or the tool cache). The worst case is a later QA result that
cannot be trusted. Production stays out of reach. If that matters more than the
minutes, recreate the container daily (`docker compose up -d --force-recreate`
from cron), which also empties the database.

## Where it runs

Not CT 105: that LXC has 4 cores and 8 GB at load 4–7 already, and QA starts four
Vite servers, Chromium and Postgres. Give it its own LXC on the Proxmox host with
Docker, at least 4 cores and 8 GB (the compose defaults, `QA_RUNNER_CPUS` and
`QA_RUNNER_MEMORY`). Outbound internet is needed (GitHub, npm, Playwright CDN); no
inbound ports.

## Setup (one-time)

1. On the new host, check out the repo and go to `infra/qa-runner`.
2. Get a registration token: GitHub → repo Settings → Actions → Runners → New
   self-hosted runner (valid one hour). Put `RUNNER_TOKEN=<token>` in `.env` next to
   `compose.yml` (mode 0600).
3. `docker compose up -d --build`. The runner registers as `tagaroa-qa` with labels
   `self-hosted,tagaroa-qa` and keeps its credentials in the `config` volume. Remove
   `RUNNER_TOKEN` from `.env` afterwards.
4. Check it shows as Idle under repo Settings → Actions → Runners.
5. Turn it on: repo Settings → Secrets and variables → Actions → Variables →
   `QA_RUNS_ON` = `["self-hosted","tagaroa-qa"]`. Then Actions → QA → Run workflow on
   `main` and watch both jobs pick up `tagaroa-qa` and pass.

To go back to hosted runners, delete `QA_RUNS_ON`. Do that before taking the runner
down for long: a job with no matching runner waits up to 24 hours, then fails.

## Updating

When `@playwright/test` changes, rebuild with `--build-arg PLAYWRIGHT_VERSION=<new>`
(or bump the default in the Dockerfile) so the system libraries match the browsers.
Browsers themselves are downloaded by the job and reused across jobs.

## Capacity

One runner runs one job at a time. A pull request's `checks` and `workflows` jobs
therefore run one after the other, and the weekly four-browser matrix takes about an
hour. Register a second container with another `RUNNER_NAME` if that is too slow.
