# Ops notes

Raw notes on where Tagaroa runs and the tools around it. Workflow specs live in
`workflows/`. No secrets here, only where they are kept.

## Terms

- **dev**: the shared, always-on deployment that tracks `main`. Not local `bun dev`.
- **prod**: the deployment real employees use. Treated as real from day one.
- **release**: promoting one already-deployed-to-dev commit (by full sha) to prod.
- **brief**: the decision-ready summary in a Multica issue that asks for a release.

## Machines

- **Proxmox host** `root@10.10.10.2`. LXCs (all Alpine unless noted, DNS pinned to 8.8.8.8):
  - 103 `network` (10.10.10.3): Pangolin site agent (`pangolin-site`), the tunnel to the edge.
  - 105 `dev-server` (10.10.10.5): dev stacks of other projects (TMS, PCS, IFRS16,
    ERP gateway, TSI-AM), GitLab runners, Arcane edge agent. 4 cores, 8 GB, 48 GB disk,
    load already 4-7. Tagaroa dev and its GitHub runner go here.
  - 107 `multica` (10.10.10.7): Multica.
  - 114 `zot-registry` (10.10.10.14): Zot registry on `:8080` (plain HTTP, LAN only).
    Images are named `10.10.10.14:8080/<group>/<name>:<tag>`.
  - 115 `gitlab` (10.10.10.15): GitLab at git.engineering.tagaroa.cc. Not used by Tagaroa.
  - 116 `postgres-node-1`, 106 `nextcloud`, 120 `service`.
- **OCI edge VM** `ubuntu@168.107.65.35`, Singapore, Ampere A1 **arm64**, 2 cores,
  12 GB RAM (~8 GB available), 48 GB disk (37 GB free), Ubuntu 26.04. Runs Pangolin
  (+ Gerbil, Traefik), NetBird server/dashboard/gateway, Arcane manager, monitoring
  (VictoriaMetrics, vmalert, VictoriaLogs, VictoriaTraces, Grafana, Vector, exporters,
  blackbox exporter), Valkey, and the shared Postgres. Prod goes here.
  Cannot reach the home LAN (10.10.10.0/24) directly.

## Shared Postgres on the OCI VM

- Container `postgres`, image `tagaroa-postgres-pgbackrest:18-alpine`, compose in
  `/home/docker/postgres` (root-owned). Networks `postgres_backend`, `oci_egress`.
  PgBouncer in front; postgres/pgbouncer exporters feed Grafana.
- Databases today: pangolin, netbird(+activity, idp), arcane, tms, traccar.
- Backups already work: pgBackRest stanza `main`, rendered config `/run/pgbackrest.conf`
  (from `pgbackrest.conf.template`), WAL archiving on, repo in OCI Object Storage bucket
  `tagaroa-postgres-backups` (ap-singapore-1). `pgbackrest-housekeeping.timer` (host
  systemd, ~03:15 UTC daily) runs `/home/docker/postgres/pgbackrest/backup-housekeeping.py`.
  Daily diff, retention 1 full / 4 diff. Cluster-level, so a new database is covered.
- Known gaps (not yet decided): `cipher: none`, one full kept, backups in the same OCI
  account as the VM, no recorded restore test.

## Existing dev-stack pattern on CT 105 (TMS is the reference)

- Linux user per project (`tms`, in group `docker`), files in `/home/<user>/apps`:
  `compose.yml`, `.env` (0600, secrets), `.release.env` (image refs, written by deploy),
  `Caddyfile`, `deploy.sh`.
- `deploy.sh <server-image> <web-image>`: writes `.release.env`, `compose pull`, starts
  db, runs a one-shot `migrate` service, then `up -d --wait --remove-orphans` the rest.
- Project's own `caddy:2-alpine` on a unique host port (TMS: 22816) routes `/api/*` to
  the API and everything else to web. Pangolin resource `tms.dev.tagaroa.cc` →
  10.10.10.5:<port>.
- CI (GitLab) builds images tagged with the full commit sha, pushes to Zot, and calls
  `deploy.sh` over SSH.

## Tagaroa specifics

- Repo `edwinhati/tagaroa` on GitHub, private, free plan (2000 Actions minutes/month,
  no required-reviewer environments). QA (`.github/workflows/qa.yml`) runs on hosted runners, or on the sandboxed
  self-hosted QA runner when the repo variable `QA_RUNS_ON` is set (`workflows/qa-runner.md`).
- Deployables: `servers/core` (NestJS on Bun, `start:prod` = `bun dist/main.js`,
  Postgres, Better Auth); SPAs built with `vite build` (TanStack Start, SPA mode):
  `apps/auth`, `apps/admin`, `apps/workspace`, `domains/engineering` (mounted under
  `/engineering` of workspace; locally via Turborepo's microfrontends proxy, which is
  dev-only). `apps/cloud`, `apps/mail` have no build yet; other domains don't exist.
- Migrations are explicit (`drizzle-kit migrate`, files in `servers/core/drizzle`), never
  at startup. `docs/security/access-control-rollout.md`: migrate before deploying app changes.
- Core env: `servers/core/.env.example`. Production requires HTTPS `TRUSTED_ORIGINS`,
  `PASSKEY_ORIGINS`, `PASSKEY_RP_ID`; an unconfigured notification channel fails loudly.
- Session cookies (ISSUE-16, ISSUE-30). In production mode every Better Auth cookie is
  host-only on the API host, `__Host-better-auth.*` (`Secure`, `Path=/`, no `Domain`):
  `dev.tagaroa.cc` on dev, `tagaroa.cc` on prod. The browser sends it to that exact host
  and nowhere else, so prod's never reaches dev, Multica, GitLab or any other host under
  the zone, and `__Host-` refuses a same-named cookie a sibling host plants with a
  `Domain`. The door (built) and every other app call core on the API host directly,
  cross-origin but same-site, so its `SameSite=Lax` cookie goes along; core refuses a
  production trusted origin outside the API host. One session per person per browser,
  so `SESSION_POLICY.concurrentSessions` is unaffected. Local dev keeps the door same-origin
  through Vite (Brave/Safari dropped the cookie from `localhost:8080`).
  - Checked: `infra/dev/images.test.sh` (cookie attributes, session read from the API
    host) and `infra/dev/browsers.test.sh <core-image>`, which builds a web image for
    `*.dev.localtest.me`, puts HTTPS in front and signs in through the door in
    Chromium, Firefox and WebKit.
  - Rejected: `Domain=tagaroa.cc` (sends prod tokens to every host under the zone; a
    stolen one is account takeover for up to 7 days, `bearer()` accepts it with no
    cookie); a prod `work.tagaroa.cc` zone (not needed); per-host sessions through each
    app's own `/api` (three sessions per person, plus a hand-off between hosts); a single
    origin with path routing (moves every app's base path for no extra isolation).
  - Still true: the edge terminates TLS, so it sees every cookie.

## Decisions so far (2026-10-31)

- Dev: deployed, tracks `main`, CT 105, same pattern as TMS.
- Prod: OCI edge VM, shared Postgres (new `tagaroa` db + role, connected directly on
  `postgres_backend`, not through PgBouncer, which runs in transaction mode), real from
  day one (real email, admin MFA, backups, approval before each release).
- Both environments run `NODE_ENV=production` and send real email through Resend.
  No Resend account exists yet; creating it and verifying `tagaroa.cc` is manual setup.
  Only a message sent on an unconfigured channel fails, so SMS/WhatsApp can stay unset.
- Release rebuilds arm64 images from the released sha (prod does not reuse dev's image).
  Required anyway: SPAs bake environment URLs in at build time.
- Approving a release = setting its Multica issue to In Progress; a 5-minute schedule on
  the self-hosted runner picks it up. One open release issue at a time, rewritten for
  the newest dev sha. A failed release rolls back and sets the issue to Blocked.
- Alerts: vmalert uses `-notifier.blackhole` (nobody is notified). The Alertmanager
  route to an "Ops alert" Multica autopilot was removed in ISSUE-108.
- Weekly point-in-time restore test of the pgBackRest backups; the result is in the
  journal and a metric only.
- Each new hostname needs a Cloudflare DNS record → 168.107.65.35 unless a wildcard
  already covers it (`tms.dev.tagaroa.cc` resolves, so check for `*.dev` first).
- Out of scope for now: encrypting backups, keeping more than one full, copying
  backups outside the OCI account.
- Hostnames: prod `auth.` `admin.` `app.tagaroa.cc` plus the API at `tagaroa.cc/api`,
  passkey RP ID `tagaroa.cc`; dev `auth.` `admin.` `app.dev.tagaroa.cc` plus the API at
  `dev.tagaroa.cc/api`, RP ID `dev.tagaroa.cc`.
  DNS is on Cloudflare; everything public resolves to the edge (168.107.65.35).
- Builds: a self-hosted GitHub Actions runner, in Docker on CT 105
  (`ghcr.io/actions/actions-runner`, host docker socket mounted), runs only pushes to
  `main` and manual dispatch, never PR code.
- Prod images must be multi-arch (amd64 for dev, arm64 for prod).
- Registries: dev images in Zot (home, LAN only). Prod images in OCI Container Registry
  (Singapore), pulled by the VM locally. Zot is not published through Pangolin.
- Ingress: every hostname is a Pangolin resource. Prod: on the OCI VM's local site,
  public. Dev: site "PVE Home" → 10.10.10.5:<tagaroa caddy port>, VPN-only (NetBird),
  same rule shape as Multica's web pages.
- Dev deploys only after the QA workflow succeeds on that `main` commit. Docs-only
  pushes skip QA, so they never deploy (nothing deployable changed).
- Release approval: a Multica issue with the brief, approved by running the
  "Deploy prod" workflow for that sha.
- Rollback (from `docs/security/access-control-rollout.md`): roll back application
  images only, keep the additive schema; never restore revoked grants as a shortcut.
- `bun run security:preflight` in `servers/core` checks a target's production config and
  migration state; a prod deploy should refuse to proceed when it fails.
