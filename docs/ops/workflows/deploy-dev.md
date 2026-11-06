# Deploy dev

Every `main` commit that passes QA is running on dev a few minutes later, with no human
involved. Dev is how you and the agents try merged work before it is released.

Context and machine details: `../NOTES.md`.

## Trigger

- **Event:** the `QA` workflow (`.github/workflows/qa.yml`) completes with conclusion
  `success` for a `push` to `main` (`on: workflow_run`, `workflows: [QA]`,
  `types: [completed]`, then `if:` conclusion success, event push, branch main).
  Deploy `github.event.workflow_run.head_sha`, never the branch tip.
- **Manual:** `workflow_dispatch` with an optional `sha` input (default: current `main`),
  for redeploying after a config change. It must refuse a sha that is not on `main`.
- Docs-only pushes skip QA, so they never deploy. That is intended.
- Concurrency group `deploy-dev`, `cancel-in-progress: false`. GitHub keeps only the
  newest pending run, so a burst of merges deploys the last one.

## Checkpoint

None. A failure notifies Rex (see "On failure").

## What it builds

All files below are new and live in the repo; the workflow is `.github/workflows/deploy-dev.yml`,
`runs-on: [self-hosted, tagaroa]`.

1. **Core image** `10.10.10.14:8080/tagaroa/core:<sha>`, from `servers/core/Dockerfile`,
   one multi-arch image: `linux/amd64` for dev and `linux/arm64`, which a release later
   copies to prod unchanged (`release-prod.md`, "Deploy"). Each platform is pushed as
   `core:<sha>-<arch>` without attestations and joined with `docker manifest create
   --insecure`, which works with the default buildx driver and Zot's plain HTTP.
   QEMU binfmt (`infra/runner/tagaroa-binfmt.openrc`) must be installed on CT 105.
   - Build stages on `oven/bun` (version pinned to the repo's `1.4.2`): `turbo prune
     @servers/core --docker`, with turbo at the version `bun.lock` pins, then `bun install
     --frozen-lockfile` on the pruned manifests and lockfile and `bun run build` in
     `servers/core`. A second `turbo prune --production` tree gets the production install.
     Both installs see only core's workspaces, so a change anywhere else (docs, another
     app) reuses them from the layer cache.
   - Runtime stage `oven/bun:1.4.2-slim`: `dist/`, production dependencies, `drizzle/`
     (migration files) and `scripts/`. Default command `bun dist/main.js`. Non-root user.
   - Add `servers/core/src/migrate.ts` (compiled into `dist/migrate.js`): applies
     `drizzle/` with drizzle-orm's migrator on the same driver the app uses, then exits.
     `drizzle-kit` stays a dev dependency and is not in the image.
   - Healthcheck: `GET http://127.0.0.1:8080/api/health/live`.
   - If any dependency ships a native binary, the build must still produce a working
     image for `linux/arm64` (release builds it for prod), so check with
     `docker buildx build --platform linux/arm64` once.
2. **Web image** `10.10.10.14:8080/tagaroa/web-dev:<sha>`, from `infra/web/Dockerfile`.
   The four SPAs bake their URLs in at build time, so the web image is per-environment.
   - Build args (all `https://`), for dev:
     - `VITE_AUTH_BASE_URL` = `https://dev.tagaroa.cc` (all four apps)
     - `VITE_AUTH_URL` = `https://auth.dev.tagaroa.cc` (admin, workspace, engineering)
     - `VITE_WORKSPACE_URL` = `https://app.dev.tagaroa.cc` (admin)
     - `VITE_ADMIN_URL` = `https://admin.dev.tagaroa.cc` (workspace, engineering)
     - `VITE_POST_SIGNIN_URL` = `https://app.dev.tagaroa.cc` (auth)
     - `VITE_TRUSTED_REDIRECT_ORIGINS` = `https://app.dev.tagaroa.cc,https://admin.dev.tagaroa.cc` (auth)
     - Read each app's `.env.example` again when building; it is the source of truth if
       it has gained a variable.
   - Runtime: `caddy:2-alpine` with the four `vite build` outputs and `infra/web/Caddyfile`.
     `auto_https off`; Pangolin terminates TLS and forwards the original `Host`.
     Site blocks take the domain from `{$BASE_DOMAIN}` (`dev.tagaroa.cc` or `tagaroa.cc`):
     - `http://auth.{$BASE_DOMAIN}` → auth build, SPA fallback to `index.html`
     - `http://admin.{$BASE_DOMAIN}` → admin build, SPA fallback
     - `http://app.{$BASE_DOMAIN}` → `/engineering*` from the engineering build (its Vite
       `base` is `/engineering`), everything else from the workspace build; SPA fallback
       within each
     - `http://{$BASE_DOMAIN}` → `/api/*` to `reverse_proxy core:8080` (request body limit
       10 MB), anything else 404
     - Hashed assets `Cache-Control: public, max-age=31536000, immutable`; `index.html`
       `no-store`.
   - This replaces Turborepo's microfrontends proxy, which is dev-server only.

## Where it runs (CT 105)

One-time setup, done by whoever implements this (needs root on CT 105):

- Linux user `tagaroa` in group `docker`, files in `/home/tagaroa/apps`, like `tms`.
- **Runner:** compose stack in `/home/tagaroa/runner` running an image built from
  `infra/runner/Dockerfile`: `ghcr.io/actions/actions-runner` (pin the version), plus the
  docker compose plugin, buildx, `openssh-client`, `skopeo` and the `multica` CLI.
  - Registered to `edwinhati/tagaroa` with labels `self-hosted,tagaroa`, restart
    `unless-stopped`, mounts `/var/run/docker.sock` and `/home/tagaroa/apps` (same path
    inside). CT 105's Docker daemon already trusts the plain-HTTP registry
    `10.10.10.14:8080`; confirm, or add it to `insecure-registries`.
  - A job-started hook (`ACTIONS_RUNNER_HOOK_JOB_STARTED`) that fails the job unless
    `GITHUB_REF` is `refs/heads/main` and `GITHUB_EVENT_NAME` is one of `push`,
    `workflow_run`, `workflow_dispatch`, `schedule`. A pull request, even one that
    edits a workflow to `runs-on: self-hosted`, must never run here: the docker socket
    is root on CT 105.
- **Stack files** live in the repo at `infra/dev/` (`compose.yml`, `deploy.sh`) and are
  copied into `/home/tagaroa/apps` by every deploy, so config changes ship through git.
  `.env` (mode 0600, owner `tagaroa`) stays on the box and is never in git.
- `compose.yml`, project name `tagaroa-dev`:
  - `postgres`: `postgres:18-alpine` (same major as prod), named volume, healthcheck.
  - `migrate`: core image, `bun dist/migrate.js`, after postgres is healthy.
  - `preflight`: core image, `bun scripts/security-preflight.ts`, after migrate.
  - `core`: core image, healthcheck as above, `restart: unless-stopped`.
  - `web`: web image, env `BASE_DOMAIN=dev.tagaroa.cc`, host port `22830:80`
    (check it is free on CT 105 first; if not, take the next free port ≥ 22830 and
    record it in `../NOTES.md`).
- `.env` keys (values set by hand once; see `servers/core/.env.example`):
  `NODE_ENV=production`, `PORT=8080`, `POSTGRES_PASSWORD`, `DATABASE_URL`
  (→ `postgres:5432/tagaroa`), `BETTER_AUTH_SECRET` (new, random),
  `BETTER_AUTH_URL=https://dev.tagaroa.cc`,
  `TRUSTED_ORIGINS=https://auth.dev.tagaroa.cc,https://admin.dev.tagaroa.cc,https://app.dev.tagaroa.cc`,
  `PASSKEY_ORIGINS=https://auth.dev.tagaroa.cc,https://app.dev.tagaroa.cc`,
  `PASSKEY_RP_ID=dev.tagaroa.cc`, `NOTIFICATION_WEBHOOK_URL=https://dev.tagaroa.cc/api/notifications/webhooks`
  (confirm the exact shape `.env.example` expects), `RESEND_API_KEY` (dev key),
  `RESEND_FROM=Tagaroa Dev <dev-no-reply@tagaroa.cc>`, `RESEND_WEBHOOK_SECRET`.
  No Twilio, WhatsApp or Frappe in dev.
- `deploy.sh <core-image> <web-image>` (POSIX sh, `set -eu`), modelled on
  `/home/tms/apps/deploy.sh`:
  1. Keep the current `.release.env` as `.release.env.previous`; write the new one.
  2. `compose pull`; `up -d --wait postgres`; `run --rm migrate`; `run --rm preflight`.
  3. `up -d --wait --wait-timeout 240 --remove-orphans core web`.
  4. If step 2's preflight or step 3 fails: restore `.release.env.previous`,
     `up -d --wait core web` on the old images, exit non-zero. A failed migrate also
     restores the old images; schema changes are additive by policy
     (`docs/security/access-control-rollout.md`, "Rollback"), so old code keeps working.
- **Pangolin:** four resources on site "PVE Home", all → `10.10.10.5:22830`:
  `auth.dev.tagaroa.cc`, `admin.dev.tagaroa.cc`, `app.dev.tagaroa.cc`,
  `dev.tagaroa.cc` (the API, under `/api`). VPN-only, the same rule shape as Multica's web pages: bypass the
  NetBird gateway IP `172.25.250.3`, block everything else. On `dev.tagaroa.cc` only, also
  bypass `/api/notifications/webhooks/*` so Resend's delivery webhooks arrive (they are
  signed and checked by core).
- **First admin:** add `servers/core/scripts/bootstrap-admin.ts <email>`. It creates the
  first `super-admin` through Better Auth's own APIs (correct password hashing), with a
  random temporary password printed once, `must_change_password` set, and MFA
  enrolment required on first sign-in. It refuses to run if any super-admin exists.
  Run once on dev: `docker compose run --rm core bun scripts/bootstrap-admin.ts <email>`.
- **Email:** create a Resend account, verify `tagaroa.cc` (DNS records in Cloudflare;
  the free plan allows one domain, shared by both environments), create a dev API key
  and the dev webhook pointing at `https://dev.tagaroa.cc/api/notifications/webhooks/resend`.

## Steps (each run)

1. Check out the sha.
2. Build and push the images: core for amd64 and arm64, dev's web image for amd64, and
   prod's web image `web-prod:<sha>` for arm64 with prod's URLs (the dev args with
   `dev.` removed). Use the runner's local Docker layer cache; no registry cache needed.
3. Copy `infra/dev/compose.yml` and `infra/dev/deploy.sh` into `/home/tagaroa/apps`
   and run `deploy.sh` with the two image references.
4. Smoke check against `http://10.10.10.5:22830` with `Host:` headers:
   `dev.tagaroa.cc` `/api/health/live` → 200; `app.`, `auth.`, `admin.` `/` → 200
   HTML; `app.` `/engineering` → 200 HTML. Fail the run on any miss.
5. Hand off to the release loop: create or update the release brief
   (`release-prod.md`, "Brief"). This is a separate `brief` job that needs `deploy`,
   so a brief failure is not reported as a broken dev. The run is done when the
   brief is current. Multica reporting is optional: `infra/release/brief-step.sh`
   turns a failed login or brief update into a `::warning::` and a `failed=true`
   output, and the run stays green. Production still fails closed: with no current
   approved brief `release-prod.yml` releases nothing, and `release.sh` stops on any
   Multica error.

## On failure

Dev stays on the previous images (deploy.sh rolls back). The workflow then POSTs to the
"Ops alert" Multica webhook (`ops-alerts.md`) with `kind: dev-deploy-failed`, the sha,
the failing step and the run URL, using `Idempotency-Key: dev-deploy-<run_id>-<attempt>`.
Rex investigates as with "QA failed on main". No release brief is created or updated
for a failed sha.

If the deploy succeeded and only the brief update failed, dev stays on the new images
and the `brief` job sends `kind: dev-brief-failed` instead, with the brief log tail.
Neither the brief nor that alert can fail the run: a failed alert delivery is a
warning too. A failed build, deploy or smoke check still fails the run.

## Secrets (GitHub repo secrets, read only by the self-hosted runner)

- `MULTICA_TOKEN`: a Multica personal access token (`mul_…`) for edwinhati@tagaroa.com,
  used with `multica login --token` and `MULTICA_SERVER_URL=http://10.10.10.7:8080`
  on the self-hosted CT 105 runner. The same PAT authenticates over this LAN path;
  the public proxy path drops authentication from that runner (ISSUE-20).
  `release-prod.yml` uses the same runner endpoint for its Multica CLI calls.
  The public Multica UI and user-facing links remain `https://multica.engineering.tagaroa.cc`.
- `MULTICA_OPS_WEBHOOK`: the "Ops alert" autopilot's webhook URL.

`infra/ops/ops-alert.sh` posts directly to `MULTICA_OPS_WEBHOOK`; it does not use
`MULTICA_SERVER_URL` or the CLI PAT. Changing the CLI endpoint therefore does not
resolve the separately observed webhook 401. Verify the webhook's routing and
authentication separately before changing its secret; do not rewrite its URL based
on the CLI result. The OCI monitoring sender cannot reach the home LAN directly.

## Done when

A merge to `main` that passes QA shows up on `https://app.dev.tagaroa.cc` without anyone
touching it; a deliberately broken migration on a test branch merged to `main` leaves dev
on the previous version and opens an Ops alert issue for Rex; and a pull request cannot
run a job on the self-hosted runner.
