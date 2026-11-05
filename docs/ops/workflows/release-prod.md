# Release to prod

Prod changes only when you say so, and saying so takes one status change in Multica.
Everything before that (collecting what changed, checking migrations, confirming dev
is healthy) is done for you; everything after it (building, deploying, verifying,
rolling back) also runs without you. You are asked once, late, with a brief.

Context and machine details: `../NOTES.md`. Builds on `deploy-dev.md`.

## Trigger

1. **Brief update (event):** the last step of every successful dev deploy.
2. **Approval check (schedule):** `.github/workflows/release-prod.yml` on
   `schedule: "*/5 * * * *"`, `runs-on: [self-hosted, tagaroa]` (self-hosted runs cost
   no Actions minutes). Also `workflow_dispatch` to check immediately. Concurrency group
   `release-prod`, `cancel-in-progress: false`.

## Checkpoint

One: you approve the release issue by setting its status to **In Progress**.

GitHub runs the five-minute schedule late, sometimes by hours. To release right away,
approve from a terminal instead: `bash infra/release/approve.sh` sets the open brief to
In Progress and dispatches `release-prod.yml` on `main` (needs `multica` and `gh`
logged in). The release still runs every check in `release.sh`.

## Brief

There is at most one open release issue. It carries the label `release` (create the
label once, colour of your choice) and is assigned to edwinhati (member, not an agent),
in status **Todo**. Never put it in **In Review**: that step of the Default workflow hands
the issue to Rex.

After each successful dev deploy of sha `S`:

- Read the prod sha `P` from the VM (`/home/tagaroa/apps/.release.env`, see "Deploy").
  Before the first release there is no `P`; the brief then covers all of `main`.
- If an open release issue exists (label `release`, status `todo`), rewrite its title and
  description for `S`. Otherwise create one. Never touch an issue that is already
  `in_progress` (a release is running); start a new one after it closes.
- Title: `Release <short S> to prod`.
- Description, in this order, each part short:
  1. One line: `<n> commits, <m> migrations, dev healthy since <time>`.
  2. **Migrations:** new files under `servers/core/drizzle/` in `P..S`, by name, and for
     each whether it only adds (tables, columns, indexes) or changes/drops. Anything not
     purely additive is flagged in bold at the top as **Needs a look**.
  3. **Config:** keys added or removed in `servers/core/.env.example` or any app's
     `.env.example` in `P..S`. Each new required key is flagged **Needs a look**, because
     prod's `.env` must have it before approval.
  4. **Changes:** the merged PRs in `P..S` as `#<n> <title> (ISSUE-<k>)`, linked.
     Commits without a PR listed by subject.
  5. Links: the dev deploy run, the QA run for `S`, `https://app.dev.tagaroa.cc`.
  6. Last line: `Approve: set this issue to In Progress.`
- The full sha `S` is stored in the issue's metadata (`multica issue metadata`, key
  `sha`) so the deploy never parses prose.

## Deploy (after approval)

The scheduled check lists issues with label `release` in status `in_progress` and
takes the oldest. For it:

1. Comment `Releasing <short S>…` (so a second check run won't start it again; the
   concurrency group also prevents overlap).
2. **Build** for `linux/arm64` at sha `S`:
   - Core image from `servers/core/Dockerfile`. Build the JS on the runner's own
     platform (`FROM --platform=$BUILDPLATFORM` for the build stage) and only assemble
     the arm64 runtime stage, so no slow emulated compile. QEMU binfmt must be installed
     once on CT 105 for the arm64 `RUN` steps that remain.
   - Web image from `infra/web/Dockerfile` with the prod build args: same as dev's with
     `dev.` removed (`https://tagaroa.cc`, `https://auth.tagaroa.cc`,
     `https://app.tagaroa.cc`, `https://admin.tagaroa.cc`).
   - Push to OCI Container Registry, Singapore: `sin.ocir.io/<tenancy-namespace>/tagaroa/core:<S>`
     and `…/tagaroa/web:<S>`. Look up the tenancy namespace once and record it in
     `../NOTES.md`.
3. **Deploy** over SSH as `tagaroa@168.107.65.35` (key in secret `PROD_SSH_KEY`, host key
   pinned in `PROD_SSH_KNOWN_HOSTS`): copy `infra/prod/compose.yml` and
   `infra/prod/deploy.sh` to `/home/tagaroa/apps`, then run `deploy.sh <core> <web>`.
   Same steps and rollback as dev's `deploy.sh`, with these differences:
   - `docker login sin.ocir.io` with the token in `/home/tagaroa/apps/.ocir` before pull.
   - No `postgres` service. Core, migrate and preflight join the external network
     `postgres_backend` and connect straight to `postgres:5432` (not PgBouncer: it runs
     in transaction mode, and direct is simpler for one service).
   - `web` joins the external network `pangolin_default` and publishes no host port;
     env `BASE_DOMAIN=tagaroa.cc`. Compose project name `tagaroa-prod`.
4. **Verify** from the runner through the public URLs:
   `https://tagaroa.cc/api/health/live` → 200, and `/` on `auth.`, `admin.`, `app.`
   → 200 HTML, `app.tagaroa.cc/engineering` → 200 HTML.
5. **Report:** comment `Released <short S>. <n> commits, <m> migrations applied.` with
   the run link, and set the issue to **Done**.

## On failure

- `deploy.sh` restores the previous images itself (schema stays; see `deploy-dev.md`).
  If verification in step 4 fails after deploy.sh succeeded, run
  `deploy.sh --rollback` (restores `.release.env.previous`).
- Comment on the release issue: which step failed, the last 50 lines of its log, whether
  rollback succeeded, and the run link. Set the issue to **Blocked**, keep it assigned
  to edwinhati. It is the only notification; no Ops alert.
- If the rollback itself fails, the comment says so in its first line, and the
  workflow also POSTs `kind: prod-down` to the Ops alert webhook.

## One-time setup

- **OCI VM:** Linux user `tagaroa` in group `docker`, `/home/tagaroa/apps`, the runner's
  public key in `authorized_keys`. A `tagaroa` role and database in the shared Postgres
  (`docker exec postgres psql -U postgres`), password only in prod's `.env`. Backups
  need nothing: pgBackRest covers the whole cluster.
- **OCIR:** an OCI user (or the existing one) with an auth token allowed to push and
  pull `tagaroa/*` in the tenancy. Runner: `OCIR_USERNAME`, `OCIR_TOKEN` secrets. VM:
  the same pair in `/home/tagaroa/apps/.ocir` (0600). Set the two repositories to
  private.
- **Prod `.env`** (0600, owner `tagaroa`): as dev's (see `deploy-dev.md`) with
  `DATABASE_URL` → `postgres:5432/tagaroa`, new `BETTER_AUTH_SECRET`,
  `BETTER_AUTH_URL=https://tagaroa.cc`,
  `TRUSTED_ORIGINS=https://auth.tagaroa.cc,https://admin.tagaroa.cc,https://app.tagaroa.cc`,
  `PASSKEY_ORIGINS=https://auth.tagaroa.cc,https://app.tagaroa.cc`, `PASSKEY_RP_ID=tagaroa.cc`,
  prod Resend key, `RESEND_FROM=Tagaroa <no-reply@tagaroa.cc>`, its own
  `RESEND_WEBHOOK_SECRET`, `NOTIFICATION_WEBHOOK_URL` on `tagaroa.cc`.
- **Pangolin:** four public resources on the OCI VM's local site
  (`auth.`, `admin.`, `app.tagaroa.cc`, and `tagaroa.cc` for the API under `/api`) → container `tagaroa-prod-web-1:80`;
  follow how Grafana or Arcane are published there. SSO off; the app does its own
  sign-in.
- **Resend:** prod webhook → `https://tagaroa.cc/api/notifications/webhooks/resend`.
- **First admin:** after the first release, run `bootstrap-admin.ts` once on the VM
  (see `deploy-dev.md`). Then follow `docs/security/access-control-rollout.md` for
  named operators and a second super-admin.
- **First release:** there is no prod yet, so the first brief covers all of `main`.
  Approve it like any other.
  Once it is Done, expire the `TagaroaProdDown` Alertmanager silence on the VM
  (`infra/oci/monitoring/README.md`) so prod outages reach Rex.

## Secrets (GitHub repo secrets, self-hosted runner only)

`PROD_SSH_KEY`, `PROD_SSH_KNOWN_HOSTS`, `OCIR_USERNAME`, `OCIR_TOKEN`, plus
`MULTICA_TOKEN` and `MULTICA_OPS_WEBHOOK` from `deploy-dev.md`.

## Done when

After a merge to `main`, your Multica inbox has one release issue whose brief you can
judge in under a minute; setting it to In Progress has prod on that sha within about
fifteen minutes with the issue Done; and a release whose preflight fails leaves prod on
the previous version with the issue Blocked and the reason in its comment.
