# Production

What the Production workflow (`.github/workflows/production.yml`, through
`infra/release/release.sh`) copies to the OCI VM's `/home/tagaroa/apps`:

- `compose.yml`: the stack, with each image named by the release.
- `deploy.sh`: migrates, runs the security preflight and starts a release, or brings back
  the previous one (`--rollback`).
- `onboard.sh`: starts the stack without the preflight, once, so the first operators can
  enrol before the first release.

`smoke.sh` comes from `infra/dev/`, run with the prod project name.

The VM also holds two files that are not in git, both `0600` and owned by `tagaroa`: `.env`,
prod's configuration, and `.ocir`, the OCIR login as shell-quoted `OCIR_USERNAME` and
`OCIR_TOKEN` assignments.

How a release runs, the secrets it needs and the first release are in
[docs/ops/workflows/release-prod.md](../../docs/ops/workflows/release-prod.md).

`bun run check:infra` runs `deploy.test.sh` with the other infra self-tests.
