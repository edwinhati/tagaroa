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

The workflow is `.github/workflows/deploy-dev.yml`, on GitHub-hosted runners. It builds
one image per deployable and pushes it to Artifact Keeper
(`registry.engineering.tagaroa.cc`, private, see "Registry access"):
`tagaroa/core`, `tagaroa/auth`, `tagaroa/admin`, `tagaroa/workspace` and
`tagaroa/engineering`.

**Versions come from changesets** (`.changeset/README.md`), and an image's tag is its
version. `infra/ci/plan-images.sh` applies `changeset version --snapshot alpha` to the
checkout:

- a deployable with a pending changeset gets its next version as an alpha,
  `X.Y.Z-alpha-<sha7>` (for example `0.1.1-alpha-08c2a63`);
- one without keeps its released `X.Y.Z`.

Only a tag the registry does not have yet is built, so a released version is built
once, from the commit that set it, and never replaced. A registry that cannot answer
stops the run rather than rebuild. `-beta-<sha7>` is kept free for a staging
environment.

1. **Core image** `tagaroa/core:<version>`, from `servers/core/Dockerfile`, one
   multi-arch image: `linux/amd64` for dev and `linux/arm64`, which a release later
   copies to prod unchanged (`release-prod.md`, "Deploy"). Core has native
   dependencies, so each platform builds on its own runner (`ubuntu-24.04`,
   `ubuntu-24.04-arm`), is pushed as `core:<version>-<arch>` without attestations and
   joined with `docker manifest create`.
   - Build stages on `oven/bun` (the version in `engines.bun`; `check:infra` fails on
     drift): `turbo prune @servers/core --docker`, with turbo at the version `bun.lock` pins,
     then `bun install --frozen-lockfile` on the pruned manifests and lockfile and `bun run
     build` in `servers/core`. A second `turbo prune --production` tree gets the production install.
     Both installs see only core's workspaces, so a change anywhere else (docs, another
     app) reuses them from the layer cache.
   - Runtime stage `oven/bun:<version>-slim`: `dist/`, production dependencies, `drizzle/`
     (migration files) and `scripts/`. Default command `bun dist/main.js`. Non-root user.
   - `servers/core/src/migrate.ts` (compiled into `dist/migrate.js`) applies
     `drizzle/` with drizzle-orm's migrator on the same driver the app uses, then exits.
     `drizzle-kit` stays a dev dependency and is not in the image.
   - Healthcheck: `GET http://127.0.0.1:8080/api/health/live`.
   - Pangolin sends `<base>/api` straight to core, so core caps request bodies itself
     at 10 MB (`servers/core/src/platform/http/body-limit.ts`).
2. **App images** `tagaroa/<app>:<version>` for auth, admin, workspace and engineering,
   all from `infra/web/Dockerfile` with `--build-arg APP=<workspace dir>` (and
   `APP_PATH=/engineering` for engineering), each for both platforms. Only the build
   stage runs code, on the runner's platform, so the arm64 image needs no emulation.
   - **No URLs are baked in.** Deployed, an app works out its URLs from the host it was
     loaded from (`packages/shell/src/urls.ts`): `auth.`, `app.` and `admin.<base>`, and
     the API at `<base>`. The same image runs in dev and prod. `VITE_` values still win
     locally and in e2e builds.
   - Runtime: `caddy:2-alpine` serving the app's `vite build` output on `:80` for any
     host (`infra/web/Caddyfile`). `auto_https off`; Pangolin terminates TLS.
     - SPA fallback to `_shell.html`; engineering's build sits under `/engineering`, its
       Vite `base`.
     - Hashed assets `Cache-Control: public, max-age=31536000, immutable`; the shell
       `no-store`. Brotli copies are made at build time.
     - Security headers and a CSP whose `script-src` holds the shell's inline-script
       hashes; `connect-src` allows `https://{$BASE_DOMAIN}` (`dev.tagaroa.cc` or
       `tagaroa.cc`, set by compose).
   - Pangolin's routes replace Turborepo's microfrontends proxy, which is dev-server
     only: `app.<base>/engineering*` goes to the engineering container, the rest of
     `app.<base>` to workspace.

## Registry access

Artifact Keeper runs on the OCI VM (`infra/oci/artifact-keeper/`) and is reachable only
over NetBird: Pangolin's private ingress serves `registry.engineering.tagaroa.cc` at
`172.25.251.19` and drops public traffic. Each job that needs it runs
`infra/ci/netbird-up.sh`, which installs a pinned NetBird client, joins with the
reusable, ephemeral setup key in `NETBIRD_SETUP_KEY` (group CI) and pins the private
addresses in `/etc/hosts`. NetBird policies let the CI group reach the registry and
Multica on tcp 443, nothing else. The peer disappears when the runner does.

Tokens are Artifact Keeper service-account tokens, used as the password with any
username: `REGISTRY_TOKEN` (CI, read and write on `tagaroa`) and a read-only one the
droplet is logged in with.

## Where it runs (DigitalOcean droplet)

One-time setup (needs root on `168.144.104.237`):

- Linux user `tagaroa` in group `docker`, files in `/home/tagaroa/apps`. The deploy key
  (`DEV_SSH_KEY`) is in its `authorized_keys` with `restrict`; the host key is pinned in
  `DEV_SSH_KNOWN_HOSTS`.
- NetBird peer `tagaroa-dev-droplet` in group "Dev servers" (`--disable-dns
  --block-inbound --disable-server-routes`), `/etc/hosts` entry
  `172.25.251.19 registry.engineering.tagaroa.cc`, and `docker login` as `tagaroa` with
  the read-only registry token.
- **Stack files** live in the repo at `infra/dev/` (`compose.yml`, `deploy.sh`,
  `onboard.sh`, `smoke.sh`) and are copied into `/home/tagaroa/apps` by every deploy,
  so config changes ship through git. `.env` (mode 0600, owner `tagaroa`) stays on the
  box and is never in git.
- `compose.yml`, project name `tagaroa-dev`:
  - `postgres`: `postgres:18-alpine` (same major as prod), named volume, healthcheck.
  - `migrate`: core image, `bun dist/migrate.js`, after postgres is healthy.
  - `preflight`: core image, `bun scripts/security-preflight.ts`, after migrate.
  - `core`: core image, healthcheck as above, `restart: unless-stopped`, also on the
    droplet's `pangolin_default` network as `tagaroa-dev-core-1:8080`.
  - `auth`, `admin`, `workspace`, `engineering`: one app image each, env
    `BASE_DOMAIN=dev.tagaroa.cc`, no host port, only on `pangolin_default`, where the
    Newt tunnel reaches them as `tagaroa-dev-<app>-1:80`.
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
- `deploy.sh < release` (POSIX sh, `set -eu`), modelled on `/home/tms/apps/deploy.sh`.
  The release arrives on stdin as six `KEY=value` lines, `RELEASE_SHA` and
  `CORE_`, `AUTH_`, `ADMIN_`, `WORKSPACE_` and `ENGINEERING_IMAGE`; anything else is
  refused before docker runs.
  1. Keep the current `.release.env` as `.release.env.previous`; write the new one.
  2. `compose pull`; `up -d --wait postgres`; `run --rm migrate`; `run --rm preflight`.
  3. `up -d --wait --wait-timeout 240 --remove-orphans` core and the four apps.
  4. If step 2's preflight or step 3 fails: restore `.release.env.previous`, start
     the old images again, exit non-zero. A failed migrate also
     restores the old images; schema changes are additive by policy
     (`docs/security/access-control-rollout.md`, "Rollback"), so old code keeps working.
- **Pangolin:** four resources on site "DigitalOcean Droplet SG", each to its container:
  - `auth.dev.tagaroa.cc` → `tagaroa-dev-auth-1:80`
  - `admin.dev.tagaroa.cc` → `tagaroa-dev-admin-1:80`
  - `app.dev.tagaroa.cc` → path prefix `/engineering` to `tagaroa-dev-engineering-1:80`
    (higher priority), everything else to `tagaroa-dev-workspace-1:80`
  - `dev.tagaroa.cc` → path prefix `/api` to `tagaroa-dev-core-1:8080`; anything else
    has no target and is refused

  VPN-only, the same rule shape as Multica's web pages: bypass the
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

1. `sha`: resolve the sha and refuse one that is not on `main` or has no green QA run.
2. `plan` (joined to NetBird): each deployable's version and image, and which images
   the registry lacks (see "What it builds").
3. `build-core` (one job per platform) and `build-apps` (one job per app), only for
   the missing images. No layer cache: hosted runners start clean.
4. `deploy`: join core's two platforms if core was built, copy the stack files into
   `/home/tagaroa/apps` over SSH and feed `deploy.sh` the release lines. The droplet
   pulls over its own NetBird link.
5. Smoke check: `smoke.sh` on the droplet asks each container on `pangolin_default`,
   where Pangolin reaches it: core `/api/health/live` → 200 JSON; auth, admin and
   workspace `/` → 200 HTML; engineering `/engineering` → 200 HTML. Fail the run on
   any miss.
6. Hand off to the release loop: create or update the release brief
   (`release-prod.md`, "Brief"). This is a separate `brief` job that needs `deploy`,
   so a brief failure is not reported as a broken dev. The run is done when the
   brief is current. Multica reporting is optional: `infra/release/brief-step.sh`
   turns a failed login or brief update into a `::warning::`, and the run stays
   green. Production still fails closed: with no current
   approved brief `release-prod.yml` releases nothing, and `release.sh` stops on any
   Multica error.

## On failure

Dev stays on the previous images (deploy.sh rolls back) and the run fails; the failed
run in GitHub Actions is the only record. No release brief is created or updated
for a failed sha.

If the deploy succeeded and only the brief update failed, dev stays on the new images
and the `brief` job ends with a warning; the brief cannot fail the run. A failed
build, deploy or smoke check still fails the run.

## Secrets (GitHub repo secrets)

- `NETBIRD_SETUP_KEY`: the reusable, ephemeral NetBird setup key "GitHub Actions (CI)",
  group CI. It expires 2027-11-14; make a new one in the NetBird dashboard before then.
- `REGISTRY_TOKEN`: Artifact Keeper service-account token, read and write on `tagaroa`.
- `DEV_SSH_KEY`, `DEV_SSH_KNOWN_HOSTS`: deploy key for `tagaroa@168.144.104.237` and
  its pinned host key.
- `MULTICA_TOKEN`: a Multica personal access token (`mul_…`) for edwinhati@tagaroa.com,
  used with `multica login --token` against `https://multica.engineering.tagaroa.cc`,
  reached over NetBird at its private ingress address `172.25.251.12`.

GitHub does not pass secrets to workflows run from forks, and only `main` runs these
workflows, so pull request code never sees them.

## Done when

A merge to `main` that passes QA shows up on `https://app.dev.tagaroa.cc` without anyone
touching it; a deliberately broken migration on a test branch merged to `main` leaves dev
on the previous version with a failed run.
