# Shipping Tagaroa: two workflows, with the release PR merge as the approval

Research date: 2026-11-16. Primary sources only: the workflow files and Changesets configs of open-source monorepos that use Changesets and Turborepo, read through the GitHub API at pinned commits; the source and README of `changesets/action` v2.1.2 and of `@changesets/cli` 3.0.3 (the version `bun.lock` pins) with its docs site; GitHub's Actions, billing and plan docs; the Turborepo docs bundled with turbo 2.11.10 (the installed version); first-party engineering posts and docs from GitHub, Amazon (AWS Builders' Library), Google (SRE book, DORA, Cloud Deploy), Stripe, Slack, GitLab and Vercel, plus Martin Fowler's bliki for the expand/contract pattern. Theo's post was read through the fxtwitter and vxtwitter APIs. Tagaroa's facts come from the files named in section 2, as they are on branch `docs/issue-127-private-repo-ci` today. Nothing was run against dev, prod or GitHub settings. Anything that could not be confirmed is marked **unverified**.

Link prefixes used below:

- `HIVE` = `https://github.com/graphql-hive/console/blob/19786829183634354fe69d839c5ee0cac0f46110` (2026-11-13)
- `TRIG` = `https://github.com/triggerdotdev/trigger.dev/blob/2fbd5c7cf4e9c8e19b88e2b72a7133795611e33d` (2026-11-12)
- `CAL` = `https://github.com/calcom/cal.diy/blob/ae027bb70e694e2d2c44569f398d6cbcee0389b1` (2026-11-13; `calcom/cal.com` now resolves to `calcom/cal.diy`)
- `HL` = `https://github.com/highlight/highlight/blob/3bf002113e555d1ba3d4df648ed44e3503a27e96` (2026-10-23)
- `TEX` = `https://github.com/vercel/turborepo/blob/ef00d80db2f08d610582dbcd592064c2c4247d45/examples/with-changesets` (2026-11-14)
- `TDOCS` = `https://github.com/vercel/turborepo/blob/e521641a142a24abe4554a77fdd6551e47e96fb3/apps/docs/content/docs` (tag `v2.11.10`, identical to `node_modules/turbo/docs`)
- `CSA` = `https://github.com/changesets/action/blob/ae32849d5ba541f9ae29e40e22a623bc13562f51` (tag `v2.1.2`)
- `CS` = `https://github.com/changesets/changesets/blob/c9269c01af5f3f7463adc648890fc3a8a729dd18` (tag `@changesets/cli@3.0.3`)
- `T3` = `https://github.com/pingdotgg/t3code/blob/30654b3e91a51937d1dba18fc83af19d8003f5ca` (2026-11-02)
- `GHOST` = `https://github.com/github/gh-ost/blob/dfb342a4b391b7593a71927976f8841c2ac33219`

All of them are written out in full in the links.

## 1. Summary

**Recommendation: build the two workflows as agreed. Make three changes to how they connect:**

1. **Development starts Production**, with a `workflow_dispatch` that its last job sends on main. It does that only when a deployable's version at the commit differs from what prod runs. Do not trigger Production from the release PR's `pull_request: closed` event: that event races Development's image build for the same commit. Its `GITHUB_SHA` is a merge-branch commit, not the commit that landed on main. A dispatch sent with `GITHUB_TOKEN` still creates a run, which almost no other event does (section 6.3).
2. **Decide "is this a release?" from prod's running versions, not from missing git tags.** Production tags before it deploys (Release → Deploy). If tags were the ledger, a failed deploy would leave the tag in place, and a re-run would find nothing to release. Hive had to write special re-run logic for this (section 3.1).
3. **Give the migration gate an escape hatch and a baseline.** Tagaroa's own history already holds a migration that the current "additive" rule rejects: `0004_member_unique_membership.sql` deletes duplicate rows. The first prod release covers all of history, so without a baseline it would fail.

The rest of the plan matches what the sources do or recommend:

- **Merge as approval, automated gates after it.** Amazon's pipeline treats code review as "the last manual review and approval that a code change receives from an engineer" ([AWS](https://builder.aws.com/content/3ErTKQOTKc5NIw031UePBPxTQ6I/automating-safe-hands-off-deployments)). Google's release engineering describes teams that "deploy every build that passes all tests" ("Push on Green") ([SRE book ch. 8](https://sre.google/sre-book/release-engineering/)). GitHub's environment approvals are not available to Tagaroa anyway: "required reviewers are only available for public repositories" on Free, Pro and Team ([GitHub docs](https://docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments)).
- **Build once, promote by digest.** Tagaroa already does this (`release.sh` copies dev's image with `skopeo copy --all --preserve-digests` and compares the digests). None of the four open-source projects read here does it: each rebuilds its image for the release tag (section 3). Google, Amazon, Vercel and T3 Code (Theo's project) promote a fixed artifact instead (section 5.2).
- **Additive-only migrations before the deploy, contract later.** DORA, GitLab, Stripe, Amazon and Fowler all describe the same expand/contract split (section 5.3). It is the policy `deploy.sh` already relies on for rollback.

The most useful findings:

- **The `GITHUB_TOKEN` limit is narrower than often stated.** Events it causes "will not create a new workflow run", except `workflow_dispatch` and `repository_dispatch`. A pull request it opens gets runs "in an approval-required state" ([GitHub docs](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow#triggering-a-workflow-from-a-workflow)). Tags pushed by Production therefore trigger nothing, and that is fine. Tagaroa's release PR is opened by hand (`bun run release:version`), so its CI runs normally. Pushing more than three tags at once creates no `push` events at all ([GitHub docs](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#push)), so nothing should listen on release tags.
- **`changesets/action` v2 is a breaking change.** It needs Changesets CLI v3 (Tagaroa has 3.0.3). It renames every input and throws on the old names. A custom `GITHUB_TOKEN` must go in `github-token`, not in `env`. The official Turborepo `with-changesets` example still passes the v1 names to `@v2.1.2`, which the action's source rejects (section 6.1).
- **With `privatePackages.tag: true`, `changeset publish` only creates tags.** It tags each untagged version of a private package, checking local and remote tags, and reports them as published. This is the "Publish Git Tags Only" path in the Changesets docs, which point to the "Beyond npm" guide for Docker images (section 6.2). Hive is the closest real example: a private package named `hive` versions its self-hosted images (section 3.1).
- **Theo's post** (2026-11-02) shows the release graph of T3 Code's `release.yml` running in 8m 27s. That workflow builds the hosted web app early and promotes that same deployment by alias after the GitHub Release exists (section 4).

Unverified: how Hive and Trigger.dev deploy their own clouds (in private repos); whether the Turborepo example fails in practice (the source says it would; it was not run); which keys prod's `.env` holds today (not read, by design).

### Decision, 2026-11-16

Built in ISSUE-128 as recommended, with these differences:

- **What starts Production:** Development's `start-production` job dispatches it when a
  deployable's version at the commit has no release tag. Production tags before it
  deploys, so a failed Deploy is retried by re-running it, not by the next merge.
  Development needs no prod secret for this. Production still reads prod's state where
  the decision matters: the gates compare against the core version in prod's
  `.release.env`.
- **The gates' range starts at the commit that set prod's core version**, not at prod's
  release sha. A migration that was pending on dev at the last release, and so not in
  prod's image, would otherwise fall before the range. A release that keeps prod's core
  version ships no migration or config and skips both gates, as does the first release.
- **The config gate checks only keys added to `servers/core/.env.example` in that range.**
  Core defaults several of its uncommented keys (`PORT`, `NODE_ENV`, the notification
  ones), so requiring every one would fail releases that are fine.
- **Pull requests run the migration gate too.** An applied migration cannot change, so
  the allow must be in the file before dev applies it.
- **A failed release still opens a Multica issue**, with the run link. A run started
  by a `GITHUB_TOKEN` dispatch may not notify anyone (**unverified**).
- **Approval is the merge alone:** GitHub's environment approvals are not available.

## 2. What Tagaroa does today

From [qa.yml](../../.github/workflows/qa.yml), [deploy-dev.yml](../../.github/workflows/deploy-dev.yml), [release-prod.yml](../../.github/workflows/release-prod.yml), [release.sh](../../infra/release/release.sh), [approve.sh](../../infra/release/approve.sh), [brief.sh](../../infra/release/brief.sh), [plan-images.sh](../../infra/ci/plan-images.sh), [infra/dev/deploy.sh](../../infra/dev/deploy.sh), [infra/prod/deploy.sh](../../infra/prod/deploy.sh), [deploy-dev.md](../ops/workflows/deploy-dev.md), [release-prod.md](../ops/workflows/release-prod.md) and [.changeset/README.md](../../.changeset/README.md):

- **Three workflows, two links.** `QA` runs on pull requests, on pushes to main (docs-only pushes skipped) and on a weekly schedule. `Deploy dev` runs on `workflow_run: [QA]` for a successful push to main and checks out `workflow_run.head_sha`. `Release prod` is `workflow_dispatch` only, started by `approve.sh` after a person approves a Multica brief.
- **Versions decide images.** `plan-images.sh` applies `changeset version --snapshot alpha`. A deployable with a pending changeset gets `X.Y.Z-alpha-<sha7>`; one without keeps `X.Y.Z`. Only tags the registry lacks are built, so a released version is built once, from the commit that set it.
- **Prod promotes and never rebuilds.** `release.sh` reads each deployable's `package.json` version at the approved sha. It refuses anything that is not `X.Y.Z` or has no `linux/arm64` image. It copies the image to OCIR by digest and compares `sha256(skopeo inspect --raw)` on both sides. Then it runs prod's `deploy.sh`, smoke checks on the VM and two public URL checks, and only then pushes `<package>@<version>` tags.
- **The human checks are the brief's "Needs a look" flags.** `brief.sh` flags a new migration whose SQL matches `drop (table|column|schema|index|constraint)|rename|alter column|truncate|delete from|set not null|alter table .* type `. It also flags an uncommented key added to any `.env.example`.
- **Changesets config:** `privatePackages: { version: true, tag: true }`, `ignore: ["@repo/*"]`, snapshot template `{tag}-{commit-short}` ([config.json](../../.changeset/config.json)). Every workspace is private. `@changesets/cli` is 3.0.3 ([package.json](../../package.json)).
- **No release tags exist yet.** The GitHub tags API returned none on 2026-11-16. Current versions: core 0.2.0, auth 0.2.0, admin, workspace and engineering 0.1.1.

## 3. Open-source projects using Changesets and Turborepo

Candidates were checked for both `.changeset/config.json` and `turbo.json` at their default branch head on 2026-11-16:

- **Both, and they ship services or images (sections 3.1–3.4):** trigger.dev, graphql-hive/console, calcom/cal.diy, highlight/highlight. Medusa, Mastra, shadcn/ui, uploadthing and clerk/javascript also have both, but their workflows were not read for this note.
- **Missing one of the two:** formbricks, documenso, dub, create-t3-turbo and the Turborepo repo root have no Changesets config. novu has neither file on its default branch `next`. saleor-dashboard has no `turbo.json`.
- **Not reachable:** `unkeyed/unkey` returned 404 (private or removed).

### 3.1 GraphQL Hive console: a private package versions the self-hosted images

- **Config.** `privatePackages: { tag: true, version: true }`, `access: restricted`, and the services `@hive/*` are ignored ([HIVE/.changeset/config.json](https://github.com/graphql-hive/console/blob/19786829183634354fe69d839c5ee0cac0f46110/.changeset/config.json)). The images' version lives in a private package named `hive` (15.3.0) in `deployment/package.json` ([HIVE/deployment/package.json L1-L4](https://github.com/graphql-hive/console/blob/19786829183634354fe69d839c5ee0cac0f46110/deployment/package.json#L1-L4)).
- **One release workflow on push to main.** `changesets/action` (v1.5.3) runs with both `version` and `publish`, using `BOT_GITHUB_TOKEN`, not `GITHUB_TOKEN` ([HIVE/.github/workflows/release.yaml L110-L122](https://github.com/graphql-hive/console/blob/19786829183634354fe69d839c5ee0cac0f46110/.github/workflows/release.yaml#L110-L122)). Using a bot token is why their release PR ("Upcoming Release Changes") gets CI: the PR workflow checks that title ([HIVE/.github/workflows/pr.yaml L98-L101](https://github.com/graphql-hive/console/blob/19786829183634354fe69d839c5ee0cac0f46110/.github/workflows/pr.yaml#L98-L101)).
- **How the merge becomes a release.** After the release PR merges, `publish` tags the new `hive@X.Y.Z` (a private, tag-only package). The workflow then reads `publishedPackages` for `"hive"` ([L150-L159](https://github.com/graphql-hive/console/blob/19786829183634354fe69d839c5ee0cac0f46110/.github/workflows/release.yaml#L150-L159)) and builds the images with that version as the tag, or with the commit sha when no `hive` release happened ([L271-L296](https://github.com/graphql-hive/console/blob/19786829183634354fe69d839c5ee0cac0f46110/.github/workflows/release.yaml#L271-L296)). A second workflow also builds on any pushed `hive@*` tag ([HIVE/.github/workflows/release-docker.yaml L1-L40](https://github.com/graphql-hive/console/blob/19786829183634354fe69d839c5ee0cac0f46110/.github/workflows/release-docker.yaml#L1-L40)).
- **Images are rebuilt per event.** Pull requests build amd64 and arm64 images on native runners, tagged with the PR head sha. Integration and Playwright tests then run against those images ([pr.yaml L31-L82](https://github.com/graphql-hive/console/blob/19786829183634354fe69d839c5ee0cac0f46110/.github/workflows/pr.yaml#L31-L82), [build-and-dockerize.yaml L237-L266](https://github.com/graphql-hive/console/blob/19786829183634354fe69d839c5ee0cac0f46110/.github/workflows/build-and-dockerize.yaml#L237-L266)). Main builds again. Images are not promoted between environments.
- **A re-run cannot see what the first run published.** "A re-run does not publish the CLI to npm again, so it would skip the tarballs and the Docker image". The workflow works around it by comparing versions with `HEAD~1` and npm ([release.yaml L131-L143](https://github.com/graphql-hive/console/blob/19786829183634354fe69d839c5ee0cac0f46110/.github/workflows/release.yaml#L131-L143)). This is the tag-ledger problem in recommendation 2.
- **Deploy.** Staging is started by a `repository_dispatch` to a private repository, behind a repository variable ([L313-L335](https://github.com/graphql-hive/console/blob/19786829183634354fe69d839c5ee0cac0f46110/.github/workflows/release.yaml#L313-L335)). How prod is gated is **unverified** (private repo).
- **PR scoping.** None via Turborepo: the PR workflow builds everything and runs a database migration test job against Postgres ([tests-db-migrations.yaml](https://github.com/graphql-hive/console/blob/19786829183634354fe69d839c5ee0cac0f46110/.github/workflows/tests-db-migrations.yaml)).

### 3.2 Trigger.dev: version PR and release split; Docker built by direct call

- **Version PR.** `changesets-pr.yml` runs on pushes to main that touch packages or `.changeset/`. It calls `changesets/action` v1.9.0 with `version` only and `GITHUB_TOKEN` ([TRIG/.github/workflows/changesets-pr.yml L3-L53](https://github.com/triggerdotdev/trigger.dev/blob/2fbd5c7cf4e9c8e19b88e2b72a7133795611e33d/.github/workflows/changesets-pr.yml#L3-L53)). The services `webapp` and `supervisor` are in `ignore` ([TRIG/.changeset/config.json](https://github.com/triggerdotdev/trigger.dev/blob/2fbd5c7cf4e9c8e19b88e2b72a7133795611e33d/.changeset/config.json)): Changesets versions only the npm packages.
- **Their release PR gets no CI, and they mark the check green themselves.** "The changesets bot authors release PRs with GITHUB_TOKEN, which by GitHub design cannot trigger downstream workflows". The workflow then posts a successful "All PR Checks" check run on the release PR's head ([L77-L99](https://github.com/triggerdotdev/trigger.dev/blob/2fbd5c7cf4e9c8e19b88e2b72a7133795611e33d/.github/workflows/changesets-pr.yml#L77-L99)). GitHub's docs now describe such runs as created in an approval-required state instead (section 6.3).
- **How the merge becomes a release.** `release.yml` runs on `pull_request: types: [closed]` when `merged == true` and `head.ref == 'changeset-release/main'`, or on dispatch ([TRIG/.github/workflows/release.yml L3-L62](https://github.com/triggerdotdev/trigger.dev/blob/2fbd5c7cf4e9c8e19b88e2b72a7133795611e33d/.github/workflows/release.yml#L3-L62)). It publishes with `changesets/action` ([L113-L120](https://github.com/triggerdotdev/trigger.dev/blob/2fbd5c7cf4e9c8e19b88e2b72a7133795611e33d/.github/workflows/release.yml#L113-L120)). On `published == 'true'` it pushes `v.docker.X` and `helm-vX` tags ([L172-L188](https://github.com/triggerdotdev/trigger.dev/blob/2fbd5c7cf4e9c8e19b88e2b72a7133795611e33d/.github/workflows/release.yml#L172-L188)). It then calls the Docker workflow directly, "since tags pushed with GITHUB_TOKEN don't trigger other workflows" ([L190-L207](https://github.com/triggerdotdev/trigger.dev/blob/2fbd5c7cf4e9c8e19b88e2b72a7133795611e33d/.github/workflows/release.yml#L190-L207)).
- **Images are rebuilt for the release.** Every qualifying push to main builds the webapp as `main` plus the full commit sha ([TRIG/.github/workflows/publish.yml L18-L54](https://github.com/triggerdotdev/trigger.dev/blob/2fbd5c7cf4e9c8e19b88e2b72a7133795611e33d/.github/workflows/publish.yml#L18-L54), [publish-webapp.yml L83-L87](https://github.com/triggerdotdev/trigger.dev/blob/2fbd5c7cf4e9c8e19b88e2b72a7133795611e33d/.github/workflows/publish-webapp.yml#L83-L87)). The release builds again with the version tag, for `linux/amd64,linux/arm64` ([L120-L127](https://github.com/triggerdotdev/trigger.dev/blob/2fbd5c7cf4e9c8e19b88e2b72a7133795611e33d/.github/workflows/publish-webapp.yml#L120-L127)). It attests provenance; a Trivy scan reports but never blocks ([publish.yml L102-L120](https://github.com/triggerdotdev/trigger.dev/blob/2fbd5c7cf4e9c8e19b88e2b72a7133795611e33d/.github/workflows/publish.yml#L102-L120)).
- **Gates.** The npm publish job uses an `npm-publish` environment ([release.yml L49-L52](https://github.com/triggerdotdev/trigger.dev/blob/2fbd5c7cf4e9c8e19b88e2b72a7133795611e33d/.github/workflows/release.yml#L49-L52)); it is a public repo, so protection rules are available to it. Pull requests run a migration guard when migrations change ([pr_checks.yml L193-L196](https://github.com/triggerdotdev/trigger.dev/blob/2fbd5c7cf4e9c8e19b88e2b72a7133795611e33d/.github/workflows/pr_checks.yml#L193-L196)).
- **The migration guard** requires idempotent, lock-safe DDL. It has an escape hatch: "a `-- migration-guard: allow <reason>` comment … The reason is mandatory and a directive that suppresses nothing is itself a violation" ([TRIG/apps/webapp/scripts/migrationSafetyGuard.core.ts L1-L16](https://github.com/triggerdotdev/trigger.dev/blob/2fbd5c7cf4e9c8e19b88e2b72a7133795611e33d/apps/webapp/scripts/migrationSafetyGuard.core.ts#L1-L16)). Its enforced cutoff date is pinned in the npm script, so already-applied migrations are left alone ([TRIG/apps/webapp/package.json L22](https://github.com/triggerdotdev/trigger.dev/blob/2fbd5c7cf4e9c8e19b88e2b72a7133795611e33d/apps/webapp/package.json#L22)).
- **PR scoping** uses `dorny/paths-filter` per area, not `turbo --affected` ([pr_checks.yml L17-L150](https://github.com/triggerdotdev/trigger.dev/blob/2fbd5c7cf4e9c8e19b88e2b72a7133795611e33d/.github/workflows/pr_checks.yml#L17-L150)). How their cloud reaches production is **unverified** (not in this repo).

### 3.3 Cal.diy (formerly cal.com): Changesets for npm only; the app image is built and smoke-run before push

- **Changesets covers the npm packages only.** `privatePackages: { version: false, tag: false }` ([CAL/.changeset/config.json L10-L14](https://github.com/calcom/cal.diy/blob/ae027bb70e694e2d2c44569f398d6cbcee0389b1/.changeset/config.json#L10-L14)), so the app is not versioned by it. One workflow on push to main runs `changesets/action@v1` with `version` and `publish` ([CAL/.github/workflows/changesets.yml L3-L47](https://github.com/calcom/cal.diy/blob/ae027bb70e694e2d2c44569f398d6cbcee0389b1/.github/workflows/changesets.yml#L3-L47)).
- **Image.** Built on `v*` tag pushes or dispatch, natively per platform: `ubuntu-latest` and `ubuntu-24.04-arm` ([CAL/.github/workflows/release-docker.yaml L13-L150](https://github.com/calcom/cal.diy/blob/ae027bb70e694e2d2c44569f398d6cbcee0389b1/.github/workflows/release-docker.yaml#L13-L150)). The shared action builds, starts Postgres with compose, runs the container and curls `/auth/login` before it pushes ([CAL/.github/actions/docker-build-and-test/action.yml L101-L170](https://github.com/calcom/cal.diy/blob/ae027bb70e694e2d2c44569f398d6cbcee0389b1/.github/actions/docker-build-and-test/action.yml#L101-L170)).
- **Release gate.** Drafting a release is a dispatch that fails unless the actor is on an allow-list, and it uses a GitHub App token ([CAL/.github/workflows/draft-release.yml L1-L54](https://github.com/calcom/cal.diy/blob/ae027bb70e694e2d2c44569f398d6cbcee0389b1/.github/workflows/draft-release.yml#L1-L54)).

### 3.4 Highlight: continuous prod deploy on merge, migrations as their own job first

- Changesets publishes the SDKs from a Turborepo workflow on push to main ([HL/.github/workflows/turbo.yml L103-L133](https://github.com/highlight/highlight/blob/3bf002113e555d1ba3d4df648ed44e3503a27e96/.github/workflows/turbo.yml#L103-L133)).
- The cloud backend deploys on every push to main that touches it, with no approval step. A `migrate-database` job runs first, and every deploy job `needs: migrate-database` ([HL/.github/workflows/deploy.yml L1-L41](https://github.com/highlight/highlight/blob/3bf002113e555d1ba3d4df648ed44e3503a27e96/.github/workflows/deploy.yml#L1-L41)).
- Docker images build on a published GitHub release ([HL/.github/workflows/docker.yml L1-L9](https://github.com/highlight/highlight/blob/3bf002113e555d1ba3d4df648ed44e3503a27e96/.github/workflows/docker.yml#L1-L9)).
- The default branch's last commit is 2026-10-23.

### 3.5 Turborepo's `with-changesets` example

A single `Release` workflow on push to main runs `changesets/action@v2.1.2` with `publish: pnpm release` and `version: pnpm version-packages` ([TEX/.github/workflows/release.yml L3-L42](https://github.com/vercel/turborepo/blob/ef00d80db2f08d610582dbcd592064c2c4247d45/examples/with-changesets/.github/workflows/release.yml#L3-L42)). `release` builds with `turbo run build --filter=@acme/docs^...` and then runs `changeset publish` ([TEX/package.json L12](https://github.com/vercel/turborepo/blob/ef00d80db2f08d610582dbcd592064c2c4247d45/examples/with-changesets/package.json#L12)).

Those input names are v1's. v2 throws "The following inputs have been renamed" for `publish` and `version` ([CSA/src/index.ts L23-L31](https://github.com/changesets/action/blob/ae32849d5ba541f9ae29e40e22a623bc13562f51/src/index.ts#L23-L31), [CSA/src/utils.ts L166-L183](https://github.com/changesets/action/blob/ae32849d5ba541f9ae29e40e22a623bc13562f51/src/utils.ts#L166-L183)). By the source, the example fails as pinned; it was not run (**unverified** in practice). It also publishes only to npm, so it shows nothing about apps or images.

### 3.6 Comparison

| Project            | What Changesets versions                         | Release PR opened with                       | How the merge becomes a release                                                                | Images: promoted or rebuilt           | What gates prod                                            |
| ------------------ | ------------------------------------------------ | -------------------------------------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------- | ---------------------------------------------------------- |
| Hive               | npm packages + private `hive` (self-host images) | bot token, so PR CI runs                     | same push-to-main workflow; `publish` tags `hive@X`; `publishedPackages` decides the image tag | rebuilt per event (PR, main, tag)     | staging by dispatch to a private repo; prod **unverified** |
| Trigger.dev        | npm packages only (services ignored)             | `GITHUB_TOKEN`; required check self-reported | `pull_request: closed` + merged + head ref; `published` → Docker via `workflow_call`           | rebuilt for the version tag           | npm env on publish; migration guard on PRs                 |
| Cal.diy            | npm packages only                                | `GITHUB_TOKEN`                               | push to main runs version or publish; app image on `v*` tags                                   | built per tag, smoke-run, then pushed | release dispatch allow-list                                |
| Highlight          | SDKs only                                        | `GITHUB_TOKEN`                               | not tied to deploys                                                                            | Docker on release published           | none: every merge deploys, migrations first                |
| Turborepo example  | npm packages                                     | `GITHUB_TOKEN`                               | push to main                                                                                   | n/a                                   | n/a                                                        |
| **Tagaroa (plan)** | 5 private deployables, tag-only                  | by hand (`release:version`)                  | merge → Development → dispatch Production                                                      | **promoted by digest**                | automated gates                                            |

None of them uses `turbo --affected` in CI. Hive and Trigger.dev scope PR work with their own filters (section 3.2), much like Tagaroa's `qa-scope.sh`.

## 4. Theo's post

Read through `api.fxtwitter.com` and `api.vxtwitter.com` on 2026-11-16; both returned the same text.

- **Post** ([x.com/theo/status/2117174053702344982](https://x.com/theo/status/2117174053702344982)), Mon 2026-11-02 08:36:44 UTC: "My CI psychosis (not a typo) got so bad that I slopped up a Chrome extension to better visualize complex actions on Github". It has two images and no links. The images are labelled "Before" and "After". They show GitHub's run graph and the extension's graph for the same run of `release.yml` ("on: workflow_dispatch"): "Manually triggered … t3dotgg 30654b3 main", "Success", total duration 8m 27s, 22 artifacts, 23 warnings.
- **Quoted post** ([x.com/theo/status/2117150650274578440](https://x.com/theo/status/2117150650274578440)), 07:03:44 UTC the same day: "It's a small thing, but do you guys know how proud I am that we've maintained sub-10 minute release times?" Its image shows a run that took 8m 27s.
- **The graph matches T3 Code's release workflow.** Commit `30654b3` is a main commit of `pingdotgg/t3code` from 2026-11-02 06:36 UTC. That repo's `release.yml` has the jobs the screenshot shows:

  ```text
  Resolve release commit → Preflight
  Release quality checks, Release tests, Release web tests, Release server tests 1–8
  Build JS bundle → Desktop builds per OS/arch, each with Verify
  Publish GitHub Release → Publish CLI to npm, Publish AUR package, Deploy marketing site
  Deploy hosted web app → Announce release on Discord
  ```

  ([T3/.github/workflows/release.yml L51-L104, L232-L356, L512-L760, L1001-L1418](https://github.com/pingdotgg/t3code/blob/30654b3e91a51937d1dba18fc83af19d8003f5ca/.github/workflows/release.yml#L51-L104)).

- **Two patterns in that workflow match Tagaroa's plan:**
  - **One commit is chosen once and passed to every job.** "Manual stable releases build the commit of the latest published nightly, so stable only ever ships a build that nightly users have already run" ([L46-L49](https://github.com/pingdotgg/t3code/blob/30654b3e91a51937d1dba18fc83af19d8003f5ca/.github/workflows/release.yml#L46-L49)). Note that this rebuilds the same commit; it does not reuse the nightly's artifacts.
  - **The web app is built once and promoted.** The hosted app is built as a Vercel deployment early, with `--skip-domain`. `deploy_web` then aliases that same deployment to the channel domains after the GitHub Release exists ([L1045-L1050](https://github.com/pingdotgg/t3code/blob/30654b3e91a51937d1dba18fc83af19d8003f5ca/.github/workflows/release.yml#L1045-L1050), [L1152-L1222](https://github.com/pingdotgg/t3code/blob/30654b3e91a51937d1dba18fc83af19d8003f5ca/.github/workflows/release.yml#L1152-L1222)).
- **What the post does not say.** It is about seeing a large job graph, not about how to gate prod. Whether T3 Code uses Changesets or Turborepo was not checked.

## 5. How established companies ship (first-party sources)

### 5.1 What gates production

- **Amazon:** "the code review is the last manual review and approval that a code change receives from an engineer". After it, "the release of my code change to a production service is fully automated by the pipeline". Pre-production stages and integration tests gate prod: "Gamma validates that the code is both functional and that it can be safely deployed to production" ([Clare Liguori, 2020-06-18](https://builder.aws.com/content/3ErTKQOTKc5NIw031UePBPxTQ6I/automating-safe-hands-off-deployments)).
- **Google:** "Some teams perform hourly builds and then select the version to actually deploy … Other teams have adopted a 'Push on Green' release model and deploy every build that passes all tests" ([SRE book, ch. 8](https://sre.google/sre-book/release-engineering/)). Google Cloud Deploy draws the same line: "continuous delivery requires manual approval at one or more stages, continuous deployment is automatic" ([Cloud Deploy terminology](https://cloud.google.com/deploy/docs/terminology)).
- **GitHub:** the merge queue "kicks off builds and tests via GitHub Actions" and keeps main from being "updated to a failing commit" ([GitHub blog, 2024-03-06](https://github.blog/engineering/engineering-principles/how-github-uses-merge-queue-to-ship-hundreds-of-changes-every-day/)). Deploys go through canary stages, "The first is at 2%", "separated by automated 5-minute timers", and branches are deployed "before merging into the main branch" ([GitHub blog, 2021-01-25](https://github.blog/engineering/infrastructure/improving-how-we-deploy-github/)).
- **Slack:** about 12 scheduled deploys a day. A human "deploy commander" moves each build through staging, dogfood, canary (about 2%) and 10/25/50/75/100% steps ([Slack Engineering, 2020-03-29](https://slack.engineering/deploys-at-slack/)). This is the human-gated model, and it relies on traffic tiers that a single VM does not have.

### 5.2 Build once, promote

- **Google** builds hermetically, then packages are "versioned with a unique hash, and signed", and "Build artifacts are then available for system testing and canary deployments". Release tests run "in the context of what's actually being released" ([SRE book, ch. 8](https://sre.google/sre-book/release-engineering/)).
- **Amazon:** "the packages are immutable and use a checksum to verify their integrity" ([AWS](https://builder.aws.com/content/3ErTKQOTKc5NIw031UePBPxTQ6I/automating-safe-hands-off-deployments)). The article does not say in so many words that one artifact moves through every stage.
- **Vercel** separates promoting a build from rebuilding it ([Promoting a deployment](https://vercel.com/docs/deployments/promoting-a-deployment)):
  - "Promote a staged production build … won't trigger a rebuild".
  - Promoting a preview goes "through a complete rebuild", because previews are built with preview settings.
  - Instant Rollback works "by assigning your domains to an existing deployment, rather than doing a complete rebuild".

  Tagaroa can promote as-is because its app images bake in no URLs and the same image runs in dev and prod ([deploy-dev.md](../ops/workflows/deploy-dev.md)).

- **None of the open-source projects in section 3 promotes images:** each rebuilds for the release tag. Tagaroa's `release.sh` already promotes by digest, which is stronger than any of them.

### 5.3 Database migrations

- **Expand/contract.** Fowler's bliki: "Parallel change, also known as expand and contract, is a pattern to … change into three distinct phases: expand, migrate, and contract" ([Danilo Sato, 2014-05-13](https://martinfowler.com/bliki/ParallelChange.html)).
- **DORA (Google):** "you never mutate existing database objects. Instead, you add new structures alongside old ones". The new columns can be added "before the application deployment occurs". The result allows "application rollback without requiring a database rollback" ([DORA, database change management](https://dora.dev/capabilities/database-change-management/)).
- **GitLab** runs destructive migrations after the deploy, as "post deployment migrations". To remove a column: "Deploy a new version of GitLab while ignoring post deployment migrations", then migrate. On GitLab.com they "are executed on a daily basis at the discretion of release managers" ([GitLab docs](https://docs.gitlab.com/development/database/post_deployment_migrations/)).
- **Stripe** describes a "4 step dual writing pattern". "All the changes we made were incremental" ([Jacqueline Xu, 2017-02-02](https://stripe.com/blog/online-migrations)).
- **Amazon** uses two-phase deployments for changes that are not backward compatible: first prepare every server to read the new format, then activate writing it, with a bake period between. "The most common reason for not being able to roll back is a change of protocol" ([Sandeep Pokkunuri, 2019-12-05](https://builder.aws.com/content/3F04j2yRAAMBuPSPs50xwXZqg01/ensuring-rollback-safety-during-deployments)).
- **GitHub** runs MySQL schema changes through its own pipeline (skeefree with gh-ost), apart from code deploys. "Any `DROP TABLE` statement is converted into a `RENAME TABLE`", and a database engineer deploys the change ([GitHub blog, 2020-02-14](https://github.blog/engineering/infrastructure/automating-mysql-schema-migrations-with-github-actions-and-more/), [GHOST/README.md](https://github.com/github/gh-ost/blob/dfb342a4b391b7593a71927976f8841c2ac33219/README.md)). That is a human gate for schema, at a scale Tagaroa does not have.

### 5.4 Rollback

- **Amazon** rolls back automatically on alarms ("actively monitors an alarm to determine if it needs to automatically roll back") ([AWS](https://builder.aws.com/content/3ErTKQOTKc5NIw031UePBPxTQ6I/automating-safe-hands-off-deployments)).
- **Slack:** "we immediately roll back to a previous working build before starting our investigation" ([Slack](https://slack.engineering/deploys-at-slack/)).
- **Vercel's rollback** reassigns domains and "won't update environment variables" ([Instant Rollback](https://vercel.com/docs/instant-rollback)).
- **Tagaroa already has this shape.** `deploy.sh` restores the previous images on a failed migrate, preflight or start, and `--rollback` restores `.release.env.previous` ([infra/prod/deploy.sh](../../infra/prod/deploy.sh)). The schema stays, so additive-only migrations are what make the rollback safe (DORA, above).

### 5.5 What scales down to one person

- **Keep:**
  - one approval, the merge, followed by automated gates (Amazon, Google "Push on Green");
  - immutable artifacts promoted by digest (Google, Amazon, Vercel);
  - additive migrations shipped before code, destructive ones in a later release (DORA, GitLab, Fowler);
  - automatic rollback of the app, never of the schema;
  - a pre-prod environment that must be healthy first (dev plays Amazon's "gamma").
- **Skip:** one-box and wave deployments, bake times and traffic-percentage canaries. These need several hosts or traffic splitting. Amazon's one-box "serves at most ten percent of overall requests" ([AWS](https://builder.aws.com/content/3ErTKQOTKc5NIw031UePBPxTQ6I/automating-safe-hands-off-deployments)). A single prod VM behind Pangolin has no equivalent. Also skip human deploy commanders (Slack) and database-engineer review (GitHub).

## 6. Tool docs the plan depends on

### 6.1 `changesets/action` v2 (v2.1.2)

- **Requires Changesets CLI v3** (Tagaroa has 3.0.3). v2 was rewritten for it and directs CLI v2 users to `@v1` ([CSA/CHANGELOG.md L31-L89](https://github.com/changesets/action/blob/ae32849d5ba541f9ae29e40e22a623bc13562f51/CHANGELOG.md#L31-L89)).
- **Inputs** ([CSA/action.yml L6-L52](https://github.com/changesets/action/blob/ae32849d5ba541f9ae29e40e22a623bc13562f51/action.yml#L6-L52)): `github-token`, `publish-script`, `version-script`, `commit-message`, `pr-title`, `pr-draft`, `pr-base-branch`, `create-github-releases` (default true), `push-git-tags` (default true), `push-with-git-cli` (default false: commits and tags go through the GitHub API) and `cwd`.
- **Outputs** ([CSA/action.yml L53-L62](https://github.com/changesets/action/blob/ae32849d5ba541f9ae29e40e22a623bc13562f51/action.yml#L53-L62)): `published`, `published-packages`, `has-changesets` and `pr-number`. These are the v1 outputs renamed to kebab-case.
- **Breaking renames.** The old input names make the action throw ([CSA/src/index.ts L23-L31](https://github.com/changesets/action/blob/ae32849d5ba541f9ae29e40e22a623bc13562f51/src/index.ts#L23-L31)). A `GITHUB_TOKEN` in `env` that differs from `github-token` is an error ([L34-L41](https://github.com/changesets/action/blob/ae32849d5ba541f9ae29e40e22a623bc13562f51/src/index.ts#L34-L41)).
- **Modes.** If changesets exist, the action versions and opens or updates the PR. If none exist and `publish-script` is set, it publishes ([L68-L137](https://github.com/changesets/action/blob/ae32849d5ba541f9ae29e40e22a623bc13562f51/src/index.ts#L68-L137)). The sub-actions `select-mode`, `version` and `publish` split this. `select-mode` outputs `mode` as `version`, `publish` or `none` ([CSA/select-mode/README.md](https://github.com/changesets/action/blob/ae32849d5ba541f9ae29e40e22a623bc13562f51/select-mode/README.md)).
- **How it knows what was published.** Detection reads a file the CLI writes to `CHANGESETS_OUTPUT` ([CSA/src/run.ts L172-L184](https://github.com/changesets/action/blob/ae32849d5ba541f9ae29e40e22a623bc13562f51/src/run.ts#L172-L184)). Any release event in that file, tag-only included, sets `published: true` ([L235-L257](https://github.com/changesets/action/blob/ae32849d5ba541f9ae29e40e22a623bc13562f51/src/run.ts#L235-L257)).
- **Repository setting.** The action needs "Allow GitHub Actions to create and approve pull requests" turned on ([CSA/README.md L31-L32](https://github.com/changesets/action/blob/ae32849d5ba541f9ae29e40e22a623bc13562f51/README.md#L31-L32)).

**For Tagaroa:** the release PR is opened by hand, so the version half of the action is not needed. The publish half would only create the tags that `release.sh`'s `push_tags` already creates. Adopting it adds a dependency and the renames above, and buys nothing.

### 6.2 Changesets and private packages (CLI 3.0.3)

- **Versioning and tagging apps.** Changesets "can also be used to manage private packages such as applications or … docker images". `privatePackages.tag` "can be useful for automating releases of private packages via git tags" ([CS/site/guide/beyond-npm.md](https://github.com/changesets/changesets/blob/c9269c01af5f3f7463adc648890fc3a8a729dd18/site/guide/beyond-npm.md)). In v3 both `privatePackages.version` and `privatePackages.tag` default to `false` ([CS/site/guide/config.md L144-L163](https://github.com/changesets/changesets/blob/c9269c01af5f3f7463adc648890fc3a8a729dd18/site/guide/config.md#L144-L163)). Tagaroa sets both to `true`.
- **"Publish Git Tags Only"** is the documented path for packages released by a separate workflow ([CS/site/guide/automating.md L150-L160](https://github.com/changesets/changesets/blob/c9269c01af5f3f7463adc648890fc3a8a729dd18/site/guide/automating.md#L150-L160)). In the source:
  - private packages become `tag-only` releases when `privatePackages.tag` is set ([CS/packages/cli/src/commands/publish-plan/getPublishPlan.ts L205-L220](https://github.com/changesets/changesets/blob/c9269c01af5f3f7463adc648890fc3a8a729dd18/packages/cli/src/commands/publish-plan/getPublishPlan.ts#L205-L220));
  - `publish` only tags those ([CS/packages/cli/src/commands/publish/index.ts L194-L201](https://github.com/changesets/changesets/blob/c9269c01af5f3f7463adc648890fc3a8a729dd18/packages/cli/src/commands/publish/index.ts#L194-L201));
  - a tag is skipped when it exists locally or on the remote ([CS/packages/cli/src/utils/gitTags.ts L16-L32](https://github.com/changesets/changesets/blob/c9269c01af5f3f7463adc648890fc3a8a729dd18/packages/cli/src/utils/gitTags.ts#L16-L32));
  - each new tag is written to the output file ([CS/packages/cli/src/commands/git-tag/utils.ts L19-L41](https://github.com/changesets/changesets/blob/c9269c01af5f3f7463adc648890fc3a8a729dd18/packages/cli/src/commands/git-tag/utils.ts#L19-L41)).
- **`changeset git-tag`** (Tagaroa's `release:tag` script) "creates git tags for the current version of all packages … but … does not publish anything" ([CS/site/guide/cli.md L164-L170](https://github.com/changesets/changesets/blob/c9269c01af5f3f7463adc648890fc3a8a729dd18/site/guide/cli.md#L164-L170)). Whether it honours `privatePackages.tag` and skips existing tags the way `publish` does is **unverified**.
- **Version PRs and CI.** Version PRs made by GitHub Actions "do not trigger workflows" unless a personal or GitHub App token is passed ([CS/site/guide/automating.md L200-L232](https://github.com/changesets/changesets/blob/c9269c01af5f3f7463adc648890fc3a8a729dd18/site/guide/automating.md#L200-L232)). GitHub's own docs are more precise; see 6.3.

### 6.3 GitHub Actions

- **`GITHUB_TOKEN` events.** "events triggered by the `GITHUB_TOKEN` … will not create a new workflow run". The exceptions: "`workflow_dispatch` and `repository_dispatch` events always create workflow runs". A pull request created or updated by `GITHUB_TOKEN` gets runs "in an **approval-required** state". The fix: "use a GitHub App installation access token or a personal access token" ([trigger a workflow](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow#triggering-a-workflow-from-a-workflow)). "A user with write access to the repository can approve these runs from the pull request page" ([events, pull_request](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#pull_request)).
- **Tags.** "Events will not be created for tags when more than three tags are pushed at once" ([events, push](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#push)). `release.sh` pushes up to five tags in one `git push`.
- **`workflow_run`:**
  - "can't … chain together more than three levels of workflows";
  - it triggers "only … if the workflow file exists on the default branch";
  - `GITHUB_SHA` is the "Last commit on default branch", so the triggering run's `head_sha` must be checked out explicitly, as `deploy-dev.yml` does;
  - it "is able to access secrets and write tokens, even if the previous workflow was not", with a warning about cache poisoning.

  ([events, workflow_run](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#workflow_run)).

- **`pull_request` closed.** On a merge, use the `closed` type with `github.event.pull_request.merged == true`. `GITHUB_SHA` is "the SHA of the merge commit on the merge branch" (`refs/pull/N/merge`) ([events, pull_request](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#pull_request)), not the squash commit on main.
- **Dispatching from a workflow.** "Create a workflow dispatch event" needs the "Actions" repository permission (write) ([REST: workflows](https://docs.github.com/en/rest/actions/workflows)), so the dispatching job needs `permissions: actions: write`.
- **Concurrency:**
  - "at most one running job or workflow in a concurrency group", and by default a new pending run replaces the existing pending one;
  - `cancel-in-progress: true` also cancels the running one;
  - `queue: max` keeps up to 100 pending runs and cannot be combined with `cancel-in-progress: true`.

  ([concurrency](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/control-workflow-concurrency)). Concurrency can be set per job, so a workflow can cancel PR runs while a deploy job never cancels.

- **Environments on Free private repos:**
  - "required reviewers are only available for public repositories", and wait timers likewise;
  - "If you are using GitHub Free, environment secrets are only available in public repositories";
  - custom protection rules are public-only on Free, Pro and Team.

  ([deployments and environments](https://docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments)). Prod's secrets therefore stay repository secrets, as today.

- **Minutes.** GitHub now states the Free allowance as "$12 USD of included compute usage per month" ([plans](https://docs.github.com/en/get-started/learning-about-github/githubs-plans)). Rates are $0.006/min for Linux 2-core x64 and $0.005/min for Linux 2-core arm64. Standard hosted runners are free in public repositories, and self-hosted runners do not reduce the allowance ([Actions billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions)). $12 is 2,000 Linux x64 minutes, which matches the figure in `CLAUDE.md` (arithmetic, not a quoted figure). arm64 minutes cost less.

### 6.4 Turborepo (2.11.10)

- **`--affected`** runs only changed packages. In GitHub Actions it reads `GITHUB_BASE_REF` on pull requests and `GITHUB_EVENT_PATH` on pushes, and "can handle shallow clones more gracefully … because it falls back to running all tasks" ([TDOCS/crafting-your-repository/constructing-ci.mdx L64-L86](https://github.com/vercel/turborepo/blob/e521641a142a24abe4554a77fdd6551e47e96fb3/apps/docs/content/docs/crafting-your-repository/constructing-ci.mdx#L64-L86)).
- **`turbo query affected`** can skip whole jobs, which needs "a clone with sufficient history" ([L88-L118](https://github.com/vercel/turborepo/blob/e521641a142a24abe4554a77fdd6551e47e96fb3/apps/docs/content/docs/crafting-your-repository/constructing-ci.mdx#L88-L118)).
- **Caching on GitHub Actions** uses `actions/cache` on `.turbo` with a sha key and an OS-prefix `restore-keys` ([TDOCS/guides/ci-vendors/github-actions.mdx L353-L381](https://github.com/vercel/turborepo/blob/e521641a142a24abe4554a77fdd6551e47e96fb3/apps/docs/content/docs/guides/ci-vendors/github-actions.mdx#L353-L381)). This is what `qa.yml` does today.
- **`turbo prune <app> --docker`** writes `out/json` for the install layer and `out/full` for sources ([TDOCS/guides/tools/docker.mdx L85-L128](https://github.com/vercel/turborepo/blob/e521641a142a24abe4554a77fdd6551e47e96fb3/apps/docs/content/docs/guides/tools/docker.mdx#L85-L128)). Core's Dockerfile already uses it ([deploy-dev.md](../ops/workflows/deploy-dev.md)).

## 7. Implications for Tagaroa

### 7.1 Development (`development.yml`, replaces `qa.yml` and `deploy-dev.yml`)

```yaml
on:
  pull_request:
  push: { branches: [main], paths-ignore: ["**.md", "docs/**"] }
  workflow_dispatch: { inputs: { sha: { required: false } } } # redeploy dev
  schedule: [{ cron: "0 1 * * 0" }] # keep the weekly full run
concurrency:
  group: development-${{ github.ref }}
  cancel-in-progress: ${{ github.event_name == 'pull_request' }} # never cancel a main run mid-deploy
jobs:
  build: # today's qa.yml `checks` job, unchanged (lint … build, check:infra)
  migrations: # PR only, unchanged (check-migrations.sh: applied files are immutable)
  test: # today's `workflows` matrix (integration + Playwright, qa-scope.sh)
    needs: build
  plan: # main only: plan-images.sh (pending changeset → X.Y.Z-alpha-<sha7>, else X.Y.Z)
    if: github.event_name != 'pull_request'
    needs: build
  build-core: { needs: plan } # unchanged
  build-apps: { needs: plan } # unchanged
  deploy-dev:
    needs: [test, plan, build-core, build-apps] # skipped builds allowed, as today
    concurrency: { group: deploy-dev, cancel-in-progress: false }
    # join core's manifests, infra/dev/deploy.sh, smoke.sh, as today
  start-production:
    needs: deploy-dev
    permissions: { actions: write, contents: read }
    # if any deployable's package.json version at this sha differs from the
    # versions prod runs, dispatch Production with this sha
```

What changes:

- `deploy-dev` waits on `test` through `needs`. The `sha` job's "did QA pass for this sha" API check goes away, since both now run in one workflow.
- Image builds start once `build` passes and run alongside `test`. That saves wall time but spends image minutes on commits that then fail tests. To spend nothing on a red commit, make `plan` need `test`, as today.
- `start-production` decides whether to release. Prod's running versions are the tags in its `.release.env` image refs (`sin.ocir.io/…/<repo>:<version>`), read over SSH as `release.sh` already does. A dispatch made with `GITHUB_TOKEN` creates a run (6.3). The alternative is a Production trigger of `workflow_run: [Development]` with the same decision as Production's first job. That costs a short job on every main merge and needs the `event == 'push' && head_branch == 'main'` filter, because `workflow_run` hands secrets to runs started by PR runs as well (6.3).
- PRs still run Build → Test only. No images are built on PRs, unlike Hive (3.1); building them would cost minutes the plan does not need.

### 7.2 Production (`production.yml`, replaces `release-prod.yml`)

```yaml
on:
  workflow_dispatch: { inputs: { sha: { required: true } } } # from Development, or by hand to retry
concurrency: { group: production, cancel-in-progress: false }
jobs:
  plan: # sha on main, Development succeeded for it; prod's sha P and versions (ssh .release.env)
  build: # promote: release.sh's promote block, skopeo copy --all --preserve-digests to OCIR,
    needs: plan # digest compare, arm64 check, X.Y.Z only
  test: # gates (7.3); they need only `plan`, so they can run beside `build`
    needs: plan
  release: # push <package>@<version> tags for the shipped versions (release.sh push_tags)
    needs: [build, test]
  deploy: # prod deploy.sh < release, smoke.sh on the VM, the two public checks;
    needs: release # on a failed verify, `deploy.sh --rollback`
```

- **Why not `pull_request: closed` (Trigger.dev's pattern, 3.2):**
  - it starts at the same moment as Development's push run, before the `X.Y.Z` images exist;
  - its `GITHUB_SHA` is the merge-branch commit (6.3);
  - Tagaroa's release branches follow the `agent/…/issue-N-…` convention, not `changeset-release/main`, so a head-ref filter has nothing stable to match.
- **"Is this a release?" comes from prod's state, not tags.** Release tags before Deploy. Under a tag ledger, a failed deploy leaves tags behind and the re-run finds nothing, which is Hive's re-run problem (3.1). Under prod's state, a re-run deploys again. Tags then mean "released" and not "running", which differs from today's `release.sh` (it tags only after verify).
- **Pushing tags.** The tags are pushed with `GITHUB_TOKEN`, start no workflow, and more than three in one push create no events (6.3). Nothing should trigger on them.
- **The Multica reporting goes.** Prod's failure record becomes the failed run itself, as it already is for dev ([deploy-dev.md](../ops/workflows/deploy-dev.md), "On failure").

### 7.3 The two gates in Production's Test step

**Migrations: additive only.**

- **Base it on `brief.sh`'s check:** new files under `servers/core/drizzle/` in `P..S` (status `A`), each checked with its non-additive regex. An edited or removed file never passes, and `check-migrations.sh` already blocks those on PRs.
- **Add an escape hatch,** modelled on Trigger.dev's: a `-- migration-guard: allow <reason>` comment with a mandatory reason, where an unused directive fails (3.2). A contract-phase release (DORA, GitLab, 5.3) needs one.
- **Add a baseline.** On the first release `P` is empty, so the range is all of history. `0004_member_unique_membership.sql` matches `delete from` (a dedup step), so the first Production run fails without one. Allow that statement, or start the gate at a cutoff like Trigger.dev's pinned date (3.2).
- **The range is a superset.** The core image carries the migrations of the commit that set its version, not of `S`. Checking `P..S` can flag a migration whose alpha has not shipped yet. That is safe but can block. To be exact, check `P..R`, where `R` is the commit that set core's released version.

**Config: prod's `.env` has every key `servers/core/.env.example` requires.**

- **Use `brief.sh`'s convention:** an uncommented `KEY=` line is required, a commented one optional. Compare against the key names in `/home/tagaroa/apps/.env` on the VM, read over SSH as names only, for example `sed -n 's/^\([A-Z][A-Z0-9_]*\)=.*/\1/p'`. Never print values.
- **Check only core.** The apps' `.env.example` files hold `VITE_` keys that are build-time and local-only. "No URLs are baked in" ([deploy-dev.md](../ops/workflows/deploy-dev.md)), and prod's compose gives `.env` to core only ([infra/prod/compose.yml L7](../../infra/prod/compose.yml)). Including the apps would fail every release.
- **Check prod once before turning the gate on.** Some required keys may be set by compose instead of `.env` (for example `PORT`), and which keys prod's `.env` holds was not read for this note (**unverified**).

These are the two checks the brief's "Needs a look" lines asked a person to make ([release-prod.md](../ops/workflows/release-prod.md), "Brief"). Running the migration gate on PRs as well would give earlier feedback, as Trigger.dev does (3.2), at no extra job cost: it can be a step in `migrations`.

### 7.4 Files

- **Delete:**
  - `infra/release/approve.sh`, `brief.sh`, `brief-step.sh` and their tests;
  - `infra/ci/install-multica.sh`;
  - the `brief` job and `MULTICA_*` env in `deploy-dev.yml`;
  - the Multica parts of `release.sh`: the issue lookup, comments and status, and `report_failure`'s Multica calls;
  - `log-tail.sh` if nothing else uses it;
  - the `MULTICA_TOKEN` secret and Multica's address in `netbird-up.sh` calls.
- **Merge:**
  - `qa.yml` and `deploy-dev.yml` into `development.yml`;
  - `release-prod.yml` into `production.yml`.

  Keep `release.sh`'s promote, deploy, verify and tag blocks, either as jobs or as a script that takes the sha as input instead of a Multica issue.

- **Keep unchanged:** `plan-images.sh`, `netbird-up.sh`, `infra/dev/*`, `infra/prod/deploy.sh`, `smoke.sh`, `check-migrations.sh`, `check-changesets.sh`, `qa-scope.sh`, `.changeset/config.json`.
- **New:** one gate script, holding `brief.sh`'s migration and config logic plus the allow directive and the SSH key-name read.
- **Docs to rewrite:**
  - `docs/ops/workflows/release-prod.md` (the Checkpoint, Brief and Deploy sections);
  - `deploy-dev.md` (Trigger, Steps 6, Secrets);
  - `.changeset/README.md` step 5: the merge releases; approval by `approve.sh` is gone.
- **Repository settings:** none are needed for the hand-opened release PR. They would be needed if `changesets/action` opened it: "Allow GitHub Actions to create and approve pull requests" (6.1), plus an App token or approval clicks for its CI (6.3).

### 7.5 Risks the sources raise with the agreed decisions

- **No human sees a release before prod.** That is the agreed decision, and Amazon and Google run that way. They also have pre-production stages with integration tests, alarms with automatic rollback, and bake time (5.1, 5.4). Tagaroa's equivalents are thinner:
  - dev must be healthy first (the dispatch happens after `deploy-dev` and its smoke check);
  - verify plus `deploy.sh --rollback`;
  - no bake time.

  A release PR merged minutes after the change it carries reaches prod with dev having run it for those minutes only.

- **A non-additive migration needs a deliberate allow.** Rollback restores images and never the schema (5.4), so the gate is the only thing that keeps rollback safe. A wrong allow cannot be undone by `deploy.sh`.
- **The release PR must still pass CI before merge.** Nothing blocks a merge on Free (`CLAUDE.md`), and the merge is now the approval. The release PR changes only versions, changelogs and `bun.lock`, and Development still runs on it.
- **Minutes.** Production adds the promote, gates, tags and deploy, a few minutes per release. With the dispatch design nothing runs on non-release merges. arm64 minutes cost less than x64 (6.3).

## 8. Not verified

- How Hive and Trigger.dev gate and deploy their own production (private repositories).
- Whether the Turborepo `with-changesets` example fails at runtime with `changesets/action@v2.1.2` (by source it throws; not run).
- Whether `changeset git-tag` honours `privatePackages.tag` and skips existing remote tags as `changeset publish` does.
- Which keys prod's `.env` contains today, and whether compose supplies any required core key outside `.env`.
- Merge queue availability for private repositories on GitHub Free (the protected-branches page does not say).
- Whether T3 Code uses Changesets or Turborepo (not checked; it is cited only for its release graph).
