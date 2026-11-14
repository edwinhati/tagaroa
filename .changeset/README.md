# Releases

Include a changeset with user-visible features, fixes, and breaking changes. Run
`bun run changeset` from the repo root, select the affected workspaces, choose
patch/minor/major, and describe the user-facing change. Include its Multica issue
ID in the summary when available. Commit the generated Markdown with the change.
Docs, tests, and tooling-only changes usually need no changeset.

Agents can write `.changeset/<unique-name>.md` directly:

```md
---
"@apps/auth": patch
"@servers/core": patch
---

ISSUE-12: Explain the change users will see.
```

Workspaces are versioned independently, starting from their existing `0.0.0`.
Select every workspace whose behavior changes, including consumers of a changed
shared package. All workspaces remain private. Changesets tracks their versions,
changelogs, and package tags without publishing them to npm.

## Prepare a release

1. Start a release branch from current `main`, following the Multica issue branch
   and PR title conventions in `docs/agents/issue-tracker.md`.
2. Run `bun run changeset:status` to review pending changes.
3. Run `bun run release:version`. This consumes pending changesets, updates
   workspace versions and `CHANGELOG.md` files, and refreshes `bun.lock`.
4. Review and commit those changes together, run QA, and merge the release PR.
5. From the merged release commit, run `bun run release:tag`, inspect the new
   `<package-name>@<version>` tags, then push only those release tags explicitly.

Release preparation is manual. Tags identify source versions; production
promotion still uses the deployment workflow commit SHA and image digest.

## Changesets and the prod release brief

They are independent. A prod release is a Multica issue labelled `release` whose
brief names one full commit SHA that is already green on dev;
`bash infra/release/approve.sh` approves it and starts `release-prod.yml`
(`docs/ops/workflows/release-prod.md`). A changeset
never triggers, gates or replaces that approval, and `release:version` /
`release:tag` never deploy anything. Use the changesets to write the changelog and
version tags for what a release contains; mention the new tags in the brief if
you cut them.
