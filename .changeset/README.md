# Releases

Changesets decide versions, and versions decide what ships. Core and each app
(`@servers/core`, `@apps/auth`, `@apps/admin`, `@apps/workspace`,
`@domains/engineering`) are versioned independently with SemVer, and each is its own
image tagged with its version. A change with no changeset gets no new version, so no
new image, and never reaches dev or prod.

## Add a changeset

Run `bun run changeset` from the repo root, select every workspace whose behavior
changes, choose patch/minor/major, and describe the change users will see. Include
its Multica issue ID in the summary. Commit the generated Markdown with the change.

Agents can write `.changeset/<unique-name>.md` directly:

```md
---
"@apps/auth": patch
"@servers/core": patch
---

ISSUE-12: Explain the change users will see.
```

Shared packages (`@repo/*`) are not versioned (`ignore` in `config.json`), so a
changeset names only core and the apps: a change to `@repo/shell` names every app
that imports it. QA enforces this on pull requests
(`bun run check:changesets <base>`, `scripts/ci/check-changesets.sh`): a change to
what core or an app is built from, directly, through a shared package or through
`infra/web`, needs a changeset naming it, and a changeset that names a `@repo/*`
package fails. Tests, Markdown and changes outside any workspace are not checked;
if a root dependency bump or a CI change should reach an app, name it yourself. Dependabot's pull requests skip the check and ride with the
next changeset.

All workspaces stay private. Changesets tracks their versions, changelogs and tags
without publishing anything to npm.

## How versions become images

- **Dev** (every main commit that passes Build and Test): a deployable with pending changesets
  runs its next version as an alpha snapshot, `X.Y.Z-alpha-<sha7>`
  (`changeset version --snapshot alpha`, configured in `config.json`); one without
  keeps its released `X.Y.Z`. Only a tag the registry lacks is built, so a released
  version is built once and never replaced (`docs/ops/workflows/deploy-dev.md`).
- **Prod**: a release ships each deployable's released version at the sha (its
  `package.json`), never an alpha, as the very image dev built for that version.
  Before deploying, it tags each version on that sha (`<package-name>@<version>`) and
  pushes the tags (`docs/ops/workflows/release-prod.md`).
- **Staging** will run `X.Y.Z-beta-<sha7>`; it does not exist yet.

## Cut a release

1. Start a release branch from current `main`, following the Multica issue branch
   and PR title conventions in `docs/agents/issue-tracker.md`.
2. Run `bun run changeset:status` to review pending changes.
3. Run `bun run release:version`. This consumes pending changesets, updates
   workspace versions and `CHANGELOG.md` files, and refreshes `bun.lock`.
4. Review and commit those changes together, and open the release PR. It must
   consume every pending changeset: Build fails it if one landed on `main` in the
   meantime, since that app's released version would never be built. Rebase and run
   `bun run release:version` again.
5. Merging it is the approval. Its run on `main` builds the new `X.Y.Z` images and
   deploys them to dev, then starts Production, which ships them to prod after its
   gates pass (`docs/ops/workflows/release-prod.md`).

A changeset never triggers a release, and `release:version` never deploys anything:
only merging the release PR does. Pending changesets are never in a release; they stay
on dev as alphas until the next release PR consumes them.
