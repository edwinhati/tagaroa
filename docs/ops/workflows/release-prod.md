# Release to prod

Prod changes only when you say so, and saying so takes one command:
`bash infra/release/approve.sh`.
Everything before that (collecting what changed, checking migrations, confirming dev
is healthy) is done for you; everything after it (building, deploying, verifying,
rolling back) also runs without you. You are asked once, late, with a brief.

Context and machine details: `../NOTES.md`. Builds on `deploy-dev.md`.

## Trigger

1. **Brief update (event):** the last step of every successful dev deploy.
2. **Release (dispatch):** `.github/workflows/release-prod.yml`, `workflow_dispatch`
   only, on `ubuntu-24.04`. There is no schedule. Concurrency group `release-prod`,
   `cancel-in-progress: false`. The job joins NetBird (`deploy-dev.md`, "Registry
   access") to reach Artifact Keeper and Multica.

## Checkpoint

One: `bash infra/release/approve.sh` sets the open brief to **In Progress** and
dispatches `release-prod.yml` on `main` (needs `multica` and `gh` logged in). The
release still runs every check in `release.sh`.

Setting the brief to In Progress in Multica by hand approves it but starts nothing;
dispatch `release-prod.yml` afterwards (Actions → Release prod → Run workflow).

## Brief

There is at most one open release issue. It carries the label `release` (create the
label once, colour of your choice) and is assigned to edwinhati (member, not an agent),
in status **Todo**. Never put it in **In Review**: that step of the Default workflow hands
the issue to Rex.

After each successful dev deploy of sha `S`:

- Read the prod sha `P` from the VM (`RELEASE_SHA` in `/home/tagaroa/apps/.release.env`,
  see "Deploy").
  Before the first release there is no `P`; the brief then covers all of `main`.
- If an open release issue exists (label `release`, status `todo`), rewrite its title and
  description for `S`. Otherwise create one. Never touch an issue that is already
  `in_progress` (a release is running); start a new one after it closes.
- Title: `Release <short S> to prod`.
- Description, in this order, each part short:
  1. One line: `<n> commits, <m> migrations, dev healthy since <time>`.
  2. **Versions:** each deployable's version at `S` beside prod's (`core 0.1.0 → 0.2.0`,
     `auth 0.1.0 (unchanged)`). A release ships these versions, not dev's alpha
     builds, so pending changesets at `S` are named as not in this release: to ship
     them, merge a release PR first (`.changeset/README.md`).
  3. **Migrations:** new files under `servers/core/drizzle/` in `P..S`, by name, and for
     each whether it only adds (tables, columns, indexes) or changes/drops. Anything not
     purely additive is flagged in bold at the top as **Needs a look**.
  4. **Config:** keys added or removed in `servers/core/.env.example` or any app's
     `.env.example` in `P..S`. Each new required key is flagged **Needs a look**, because
     prod's `.env` must have it before approval.
  5. **Changes:** the merged PRs in `P..S` as `#<n> <title> (ISSUE-<k>)`, linked.
     Commits without a PR listed by subject.
  6. Links: the dev deploy run, the QA run for `S`, `https://app.dev.tagaroa.cc`.
  7. Last line: ``Approve: run `bash infra/release/approve.sh`.``
- The full sha `S` is stored in the issue's metadata (`multica issue metadata`, key
  `sha`) so the deploy never parses prose.

## Deploy (after approval)

The run lists issues with label `release` in status `in_progress` and takes the
oldest. For it:

1. Comment `Releasing <short S>…` (so a second check run won't start it again; the
   concurrency group also prevents overlap).
2. **Promote** each deployable's released version at `S`, the version in its
   `package.json` there (core, auth, admin, workspace, engineering). Its image was
   built when that version first reached `main` (`deploy-dev.md`, "What it builds");
   nothing is rebuilt at release time. With `skopeo copy --all --preserve-digests`
   from Artifact Keeper to OCI Container Registry, Singapore:
   `registry.engineering.tagaroa.cc/tagaroa/<name>:<version>` →
   `sin.ocir.io/<tenancy-namespace>/tagaroa/<name>:<version>`. The same multi-arch
   images dev ran; prod pulls their arm64 half.
   - Refuse, before anything reaches prod, when a version is not a release (`X.Y.Z`),
     when an image has no `linux/arm64` part, or when a copy's manifest digest
     differs from its source.
   - Look up the tenancy namespace once and record it in `../NOTES.md`.
3. **Deploy** over SSH as `tagaroa@168.107.65.35` (key in secret `PROD_SSH_KEY`, host key
   pinned in `PROD_SSH_KNOWN_HOSTS`): copy `infra/prod/compose.yml` and
   `infra/prod/deploy.sh` to `/home/tagaroa/apps`, then feed `deploy.sh` the release
   on stdin: `RELEASE_SHA=<S>` and one OCIR image per deployable.
   Same steps and rollback as dev's `deploy.sh`, with these differences:
   - `docker login sin.ocir.io` with the token in `/home/tagaroa/apps/.ocir` before pull.
   - No `postgres` service. Core, migrate and preflight join the external network
     `postgres_backend` and connect straight to `postgres:5432` (not PgBouncer: it runs
     in transaction mode, and direct is simpler for one service).
   - Core and the four apps join the external network `pangolin_default` and publish
     no host port; the apps get env `BASE_DOMAIN=tagaroa.cc`. Compose project name
     `tagaroa-prod`.
4. **Verify** from the runner through the public URLs:
   `https://tagaroa.cc/api/health/live` → 200, and `/` on `auth.`, `admin.`, `app.`
   → 200 HTML, `app.tagaroa.cc/engineering` → 200 HTML.
5. **Tag** each released version on `S` with Changesets' tag name (`@apps/auth@0.1.0`)
   and push the new ones. A version already tagged keeps its first release's tag. Prod
   is out by now, so a failed push only warns.
6. **Report:** comment `Released <short S>: core 0.2.0, auth 0.1.0, …. <n> commits, <m>
   migrations applied.` with the run link, and set the issue to **Done**.

## On failure

- `deploy.sh` restores the previous images itself (schema stays; see `deploy-dev.md`).
  If verification in step 4 fails after deploy.sh succeeded, run
  `deploy.sh --rollback` (restores `.release.env.previous`).
- Comment on the release issue: which step failed, the last 50 lines of its log, whether
  rollback succeeded, and the run link. Set the issue to **Blocked**, keep it assigned
  to edwinhati. It is the only notification.
- If the rollback itself fails, the comment says so in its first line.

## One-time setup

- **OCI VM:** Linux user `tagaroa` in group `docker`, `/home/tagaroa/apps`, the runner's
  public key in `authorized_keys`. A `tagaroa` role and database in the shared Postgres
  (`docker exec postgres psql -U postgres`), password only in prod's `.env`. Backups
  need nothing: pgBackRest covers the whole cluster.
- **OCIR:** an OCI user (or the existing one) with an auth token allowed to push and
  pull `tagaroa/*` in the tenancy. Runner: `OCIR_USERNAME`, `OCIR_TOKEN` secrets. VM:
  the same pair in `/home/tagaroa/apps/.ocir` (0600). The repositories `tagaroa/core`,
  `tagaroa/auth`, `tagaroa/admin`, `tagaroa/workspace` and `tagaroa/engineering` must
  be private: create the four app ones as private before the first release, or check
  them after it. `tagaroa/web` is no longer used.
- **Prod `.env`** (0600, owner `tagaroa`): as dev's (see `deploy-dev.md`) with
  `DATABASE_URL` → `postgres:5432/tagaroa`, new `BETTER_AUTH_SECRET`,
  `BETTER_AUTH_URL=https://tagaroa.cc`,
  `TRUSTED_ORIGINS=https://auth.tagaroa.cc,https://admin.tagaroa.cc,https://app.tagaroa.cc`,
  `PASSKEY_ORIGINS=https://auth.tagaroa.cc,https://app.tagaroa.cc`, `PASSKEY_RP_ID=tagaroa.cc`,
  prod Resend key, `RESEND_FROM=Tagaroa <no-reply@tagaroa.cc>`, its own
  `RESEND_WEBHOOK_SECRET`, `NOTIFICATION_WEBHOOK_URL` on `tagaroa.cc`.
- **Pangolin:** four public resources on the OCI VM's local site, each to its
  container, as dev's (`deploy-dev.md`): `auth.` → `tagaroa-prod-auth-1:80`, `admin.` →
  `tagaroa-prod-admin-1:80`, `app.tagaroa.cc` → `/engineering` prefix to
  `tagaroa-prod-engineering-1:80` and the rest to `tagaroa-prod-workspace-1:80`, and
  `tagaroa.cc` → `/api` prefix to `tagaroa-prod-core-1:8080`. Follow how Grafana or
  Arcane are published there. SSO off; the app does its own
  sign-in.
- **Resend:** prod webhook → `https://tagaroa.cc/api/notifications/webhooks/resend`.
- **First admin:** after the first release, run `bootstrap-admin.ts` once on the VM
  (see `deploy-dev.md`). Then follow `docs/security/access-control-rollout.md` for
  named operators and a second super-admin.
- **First release:** there is no prod yet, so the first brief covers all of `main`.
  Approve it like any other.

## Secrets (GitHub repo secrets)

`PROD_SSH_KEY`, `PROD_SSH_KNOWN_HOSTS`, `OCIR_USERNAME`, `OCIR_TOKEN`, plus
`NETBIRD_SETUP_KEY`, `REGISTRY_TOKEN` and `MULTICA_TOKEN` from `deploy-dev.md`.

## Done when

After a merge to `main`, your Multica inbox has one release issue whose brief you can
judge in under a minute; running `approve.sh` has prod on that sha within about
fifteen minutes with the issue Done; and a release whose preflight fails leaves prod on
the previous version with the issue Blocked and the reason in its comment.
