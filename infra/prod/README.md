# Production release setup

The release workflow processes only Multica issues labelled `release` that Edwin
has moved to In Progress. It validates the SHA against `main` and successful QA,
rebuilds ARM64 images, migrates, runs the existing security preflight, starts the
application, and checks the public URLs. Failed releases become Blocked with a
scrubbed log and rollback result.

Complete ISSUE-7 before merging/enabling the deployment workflows:

- Set GitHub secrets `MULTICA_TOKEN`, `PROD_SSH_KEY`, `PROD_SSH_KNOWN_HOSTS`,
  `OCIR_USERNAME`, and `OCIR_TOKEN`.
- Set repository variable `OCIR_NAMESPACE` to the tenancy namespace. Keep OCIR's
  `tagaroa/core` and `tagaroa/web` repositories private.
- Put the registry credentials in `/home/tagaroa/apps/.ocir`, mode 0600, owner
  `tagaroa`. Use shell-quoted assignments for `OCIR_USERNAME` and `OCIR_TOKEN`.
- Configure the production `.env`, dedicated `tagaroa` database/role, Resend
  delivery and webhook, DNS and Pangolin resources from the issue specification.
- Install `infra/runner/tagaroa-binfmt.openrc` as
  `/etc/init.d/tagaroa-binfmt` on CT105, mode 0755, and enable it with
  `rc-update add tagaroa-binfmt default`. It mounts binfmt in the persistent LXC
  namespace before registering the emulator. ARM64 execution was verified there.
- Establish the named recovery operators and verify their real MFA enrollment.
  First-admin bootstrap alone does not satisfy the security preflight. Complete
  controlled onboarding before attempting a normal release; keep the public
  application unavailable until preflight passes.

The self-hosted runner, production Linux user and SSH credentials were provisioned
during ISSUE-8/10 implementation. Operator-controlled accounts, email and registry
credentials remain ISSUE-7 responsibilities.

The first successful release expires only pre-deployment `TagaroaProdDown`
silences whose comment names ISSUE-10. Normal maintenance silences remain intact.
Production stays on its approved SHA; no release is approved automatically.

Run `bash infra/prod/deploy.test.sh` for isolated rollback/idempotency checks.
Run `actionlint .github/workflows/release-prod.yml` and
`shellcheck infra/prod/deploy.sh infra/release/release.sh` before changing the flow.
