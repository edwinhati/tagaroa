# Deploy

What each deploy copies to `/home/tagaroa/apps` on its server: the dev droplet from
`.github/workflows/development.yml`, the OCI VM from `scripts/ci/release.sh` in
`.github/workflows/production.yml`.

- `compose.dev.yml` or `compose.prod.yml`, copied as `compose.yml`: the stack, with each
  image named by the release. Dev runs its own Postgres; prod joins the VM's shared one.
- `deploy.sh`: migrates, runs the security preflight and starts a release, or brings back
  the previous one (`--rollback`). Same script on both servers.
- `smoke.sh`: asks core and each app, where Pangolin reaches them, whether they answer.
  Prod runs it with its project name, `smoke.sh tagaroa-prod`.

Each server also holds files that are not in git, `0600` and owned by `tagaroa`: `.env`,
its configuration, and on prod `.ocir`, the OCIR login as shell-quoted `OCIR_USERNAME` and
`OCIR_TOKEN` assignments. `deploy.sh` logs in to OCIR only when `.ocir` is there. An
Infisical agent writes these files every 5 minutes, so change them there, not in the file:
on prod `infisical-agent-prod` writes `.env` and `.ocir` (project "Tagaroa", environment
`prod`); on dev the droplet's `infisical-agent` writes `.env` (project "DigitalOcean
droplet", environment `prod`, folder `/tagaroa-dev`).

The deploy preflight needs two MFA-enrolled super-admins and a separate requester, so an
environment with none can't pass its first deploy. Dev and prod have them. A new
environment needs `onboard.sh` back from git history (removed in ISSUE-141): it starts
the stack without the preflight so the first operators can enrol.

How dev and prod deploy, and the secrets they need, are in
[docs/ops/workflows/deploy-dev.md](../../docs/ops/workflows/deploy-dev.md) and
[docs/ops/workflows/release-prod.md](../../docs/ops/workflows/release-prod.md).

`bun run check:infra` runs `deploy.test.sh` with the other self-tests.
`images.test.sh` and `browsers.test.sh` need built images; run them by hand as their
headers say.
