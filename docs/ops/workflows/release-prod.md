# Release to prod

Merging a release PR is the approval: it is the only way prod changes. Cut one with
`bun run release:version` when you want what is on dev in prod (`.changeset/README.md`,
"Cut a release"). Everything after the merge runs without you, and every check a person
used to make before approving is code that fails the release.

Context and machine details: `../NOTES.md`. Builds on `deploy-dev.md`.

## Trigger

- **Event:** Development's last job on `main`, `start-production`, after dev is deployed
  and passed its smoke check. When a deployable's version at that commit has no
  release tag (`<package>@<version>`), which only a merged release PR causes, it
  dispatches `.github/workflows/production.yml` with the commit's sha. A dispatch made
  with `GITHUB_TOKEN` still starts a run.
- **Retry:** re-run the failed jobs of the Production run, or dispatch it by hand
  (Actions → Production → Run workflow) with a full sha on `main`.
- Concurrency group `production`, `cancel-in-progress: false`. On `ubuntu-24.04`;
  Build joins NetBird (`deploy-dev.md`, "Registry access") for the dev registry and
  Report for Multica.

## Steps

**Build:** check the sha is on `main`, then promote each deployable's released version
at it, the version in its `package.json` (core, auth, admin, workspace, engineering).
Its image was built when that version first reached `main` (`deploy-dev.md`, "What it
builds"); nothing is rebuilt. With `skopeo copy --all --preserve-digests` from Artifact
Keeper to OCI Container Registry, Singapore:
`registry.engineering.tagaroa.cc/tagaroa/<name>:<version>` →
`sin.ocir.io/<tenancy-namespace>/tagaroa/<name>:<version>`. The same multi-arch images
dev ran; prod pulls their arm64 half. It refuses, before anything reaches prod, a
version that is not a release (`X.Y.Z`), an image with no `linux/arm64` part, and a
copy whose manifest digest differs from its source (`infra/release/release.sh promote`).

**Test:** the gates, `infra/release/gates.sh`. Core ships migrations and needs config
only with a new version, so both compare the commit that set prod's core version (read
from `CORE_IMAGE` in the VM's `.release.env`) with the sha. A release that keeps prod's
core version, or the first release, has nothing to check.

- **Migrations only add.** A migration added since then that drops, renames, alters a
  column's type or nullability, truncates or deletes fails the release, because a
  rollback restores images, never the schema. One that is safe anyway carries
  `-- migration-guard: allow <reason>` in its file; an allow on a migration that only
  adds fails too. Pull requests run the same check on the migrations they add, so the
  allow is in the file before dev applies it and the file can no longer change
  (`scripts/check-migrations.sh`).
- **Prod's `.env` has every new config key.** A key added uncommented to
  `servers/core/.env.example` since then must be in `/home/tagaroa/apps/.env`. Only key
  names leave the VM.

**Release:** tag each released version on the sha with Changesets' tag name
(`@apps/auth@0.1.0`) and push the new ones. A version already tagged keeps its first
release's tag. The tags are what tells Development a version has been released.

**Deploy** over SSH as `tagaroa@168.107.65.35` (key in secret `PROD_SSH_KEY`, host key
pinned in `PROD_SSH_KNOWN_HOSTS`), `infra/release/release.sh deploy`:

1. Copy `infra/prod/compose.yml`, `infra/prod/deploy.sh`, `infra/prod/onboard.sh` and
   `infra/dev/smoke.sh` to `/home/tagaroa/apps`, then feed `deploy.sh` the release on
   stdin: `RELEASE_SHA=<S>` and one OCIR image per deployable. Same steps and rollback
   as dev's `deploy.sh`, with these differences:
   - `docker login sin.ocir.io` with the token in `/home/tagaroa/apps/.ocir` before pull.
   - No `postgres` service. Core, migrate and preflight join the external network
     `postgres_backend` and connect straight to `postgres:5432` (not PgBouncer: it runs
     in transaction mode, and direct is simpler for one service).
   - Core and the four apps join the external network `pangolin_default` and publish
     no host port; the apps get env `BASE_DOMAIN=tagaroa.cc`. Compose project name
     `tagaroa-prod`.
2. **Verify:** on the VM, `smoke.sh tagaroa-prod` asks core and each app where Pangolin
   reaches them (`/api/health/live` → 200 JSON, each app's `/` → 200 HTML). From the
   runner, the two public URLs: `https://auth.tagaroa.cc/` → 200 HTML and
   `https://tagaroa.cc/api/auth/ok` → 200 JSON. The other hosts are NetBird-only
   (see "Pangolin" below), so the runner cannot reach them.

## On failure

- `deploy.sh` restores the previous images itself when one of its steps fails (schema
  stays; see `deploy-dev.md`). When verification fails after `deploy.sh` succeeded,
  Deploy runs `deploy.sh --rollback`, which restores `.release.env.previous`.
- The Report job opens a Multica issue assigned to edwinhati: the step that failed,
  whether prod was rolled back, and the run link. A failed rollback says so in its
  first line. Fix the cause, then re-run the failed jobs.
- Build, Test and Release fail before anything reaches prod. A failed Deploy leaves the
  tags in place, so the next merge does not start Production again: re-run it.

## One-time setup

- **OCI VM:** Linux user `tagaroa` in group `docker`, `/home/tagaroa/apps`, the runner's
  public key in `authorized_keys`. A `tagaroa` role and database in the shared Postgres
  (`docker exec postgres psql -U postgres`), password only in prod's `.env`. Backups
  need nothing: pgBackRest covers the whole cluster.
- **OCIR:** an OCI user (or the existing one) with an auth token allowed to push and
  pull `tagaroa/*` in the tenancy. Runner: `OCIR_USERNAME`, `OCIR_TOKEN` secrets. VM:
  the same pair in `/home/tagaroa/apps/.ocir` (0600). The repositories `tagaroa/core-service`,
  `tagaroa/auth`, `tagaroa/admin`, `tagaroa/workspace` and `tagaroa/engineering` must
  be private: create them as private before the first release, or check them after it.
- **Prod `.env`** (0600, owner `tagaroa`): as dev's (see `deploy-dev.md`) with
  `DATABASE_URL` → `postgres:5432/tagaroa`, new `BETTER_AUTH_SECRET`,
  `BETTER_AUTH_URL=https://tagaroa.cc`,
  `TRUSTED_ORIGINS=https://auth.tagaroa.cc,https://admin.tagaroa.cc,https://app.tagaroa.cc`,
  `PASSKEY_ORIGINS=https://auth.tagaroa.cc,https://app.tagaroa.cc`, `PASSKEY_RP_ID=tagaroa.cc`,
  `SIGN_IN_URL=https://auth.tagaroa.cc`,
  prod Resend key, `RESEND_FROM=Tagaroa <no-reply@tagaroa.cc>`, its own
  `RESEND_WEBHOOK_SECRET`, `NOTIFICATION_WEBHOOK_URL` on `tagaroa.cc`.
- **Pangolin:** four public resources on the OCI VM's local site, each to its
  container, as dev's (`deploy-dev.md`): `auth.` → `tagaroa-prod-auth-1:80`, `admin.` →
  `tagaroa-prod-admin-1:80`, `app.tagaroa.cc` → `/engineering` prefix to
  `tagaroa-prod-engineering-1:80` and the rest to `tagaroa-prod-workspace-1:80`, and
  `tagaroa.cc` → `tagaroa-prod-core-1:8080` (the whole host, as dev).
  Only `auth.` is public. On `tagaroa.cc`, rules let `/api/auth/*` (sign-in, MFA, SSO)
  and `/api/notifications/webhooks/*` (Resend, signed) through and drop everything else.
  `app.` and `admin.` carry the shared policy "Private ingress only". NetBird reaches
  those three hosts through the private ingress on the VM
  (`/home/docker/private-ingress`: `admin-prod` 172.25.251.26, `app-prod` .28,
  `api-prod` .29), with NetBird resources and DNS records for them. `auth.` keeps
  Pangolin SSO while prod is being onboarded, so nobody else reaches it; SSO comes off
  before the release that passes preflight (below), since the app does its own sign-in.
- **Resend:** prod webhook → `https://tagaroa.cc/api/notifications/webhooks/resend`.
- **NetBird sign-in:** `vpn.tagaroa.cc` signs people in with Tagaroa over OIDC (issuer
  `https://tagaroa.cc/api/auth`, discovery and every endpoint under the public
  `/api/auth/*`). Any active account may sign in; NetBird holds new users for approval
  and owns their groups. Its own email/password login stays as the way in when prod is
  down. Once per environment, after a release that carries it:
  1. On the VM, as `tagaroa` in `/home/tagaroa/apps`, register the client and keep the
     secret it prints once:
     `docker exec tagaroa-prod-core-1 bun scripts/oauth-client.ts you@example.com NetBird https://vpn.tagaroa.cc/oauth2/callback`
     (the email is a super-admin, who owns the client).
  2. In the NetBird dashboard, Settings → Identity Providers → Add, type Generic OIDC,
     name `Tagaroa`, issuer `https://tagaroa.cc/api/auth`, and that client ID and
     secret. If the redirect URL it shows differs from the one above, register the
     client again with it.
  3. Turn on NetBird's user approval, so a first sign-in waits for an admin.
- **First release:** prod's database has no operators, so the preflight stops the
  first release once:
  1. Merge the release PR. The run promotes every image to OCIR and tags the versions,
     then deploy.sh stops at preflight `independent-recovery-operators` and Deploy fails.
  2. On the VM, as `tagaroa` in `/home/tagaroa/apps`, run
     `sh onboard.sh you@example.com < release`, where `release` holds the six lines the
     run printed (`RELEASE_SHA=<S>` and
     `<NAME>_IMAGE=sin.ocir.io/<namespace>/tagaroa/<repo>:<version>`). It migrates,
     starts the stack without preflight, and prints the first super-admin's temporary
     password.
  3. On NetBird, sign in at `https://auth.tagaroa.cc` (through Pangolin SSO), change the
     password and enrol MFA; then, in `https://admin.tagaroa.cc`, add a second
     super-admin and a separate requester, each past their own password change and MFA
     (`docs/security/access-control-rollout.md`).
  4. Turn Pangolin SSO off on `auth.tagaroa.cc`: the operators now guard the app, and
     the release's public check of `auth.` runs from GitHub, outside SSO.
  5. Re-run the failed Deploy job. This time the preflight passes, the release records
     `.release.env`, and the public checks pass.

## Secrets (GitHub repo secrets)

`PROD_SSH_KEY`, `PROD_SSH_KNOWN_HOSTS`, `OCIR_USERNAME`, `OCIR_TOKEN` (and the repository
variable `OCIR_NAMESPACE`), plus `NETBIRD_SETUP_KEY` and `REGISTRY_TOKEN` from
`deploy-dev.md`, and `MULTICA_TOKEN`: a Multica personal access token (`mul_…`) for
edwinhati@tagaroa.com, used by Report with `multica login --token` against
`https://multica.engineering.tagaroa.cc`, reached over NetBird at its private ingress
address `172.25.251.12`.

## Done when

Merging a release PR has prod on its versions within about fifteen minutes of dev, with
the versions tagged; a release with a migration that only an allow could pass, or a new
config key prod lacks, stops at Test with prod unchanged; and a release that fails its
checks after deploying leaves prod on the previous version and a Multica issue saying so.
