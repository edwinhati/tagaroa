# Production release setup

The Production workflow (`.github/workflows/production.yml`) runs when Development
finds a merged release PR on `main`, or when dispatched by hand with a sha on `main`.
It copies each deployable's released version (core and the four apps) from Artifact
Keeper to OCIR by digest, checks that new migrations only add and that prod's `.env`
has every new config key, tags the versions, migrates, runs the existing security
preflight, starts the application, and checks the public URLs. A failed release rolls
back and opens a Multica issue with the run link.

Complete ISSUE-7 before merging/enabling the deployment workflows:

- Set GitHub secrets `MULTICA_TOKEN`, `PROD_SSH_KEY`, `PROD_SSH_KNOWN_HOSTS`,
  `OCIR_USERNAME`, `OCIR_TOKEN`, `REGISTRY_TOKEN` and `NETBIRD_SETUP_KEY`.
- Set repository variable `OCIR_NAMESPACE` to the tenancy namespace. Keep OCIR's
  `tagaroa/*` repositories private.
- Put the registry credentials in `/home/tagaroa/apps/.ocir`, mode 0600, owner
  `tagaroa`. Use shell-quoted assignments for `OCIR_USERNAME` and `OCIR_TOKEN`.
- Configure the production `.env`, dedicated `tagaroa` database/role, Resend
  delivery and webhook, DNS and Pangolin resources from the issue specification.
- Establish the named recovery operators and verify their real MFA enrollment.
  First-admin bootstrap alone does not satisfy the security preflight. Complete
  controlled onboarding with `onboard.sh` (docs/ops/workflows/release-prod.md, "First
  release") before attempting a normal release; keep the public application
  behind Pangolin SSO until the operators exist.

The production Linux user and SSH credentials were provisioned
during ISSUE-8/10 implementation. Operator-controlled accounts, email and registry
credentials remain ISSUE-7 responsibilities.

The first successful release expires only pre-deployment `TagaroaProdDown`
silences whose comment names ISSUE-10. Normal maintenance silences remain intact.
Prod changes only when a release PR is merged or Production is dispatched by hand.

Run `bash infra/prod/deploy.test.sh` for isolated rollback/idempotency checks.
Run `bun run check:infra` (actionlint, shellcheck and the release, gates and deploy
self-tests) before changing the flow.
