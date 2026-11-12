# tagaroa

Bun + Turborepo monorepo. Workspaces: `apps/*`, `packages/*`, `servers/*`.

## Agent skills

### Issue tracker

Issues live in Multica (IDs like `ISSUE-12`), managed with the `multica` CLI; PRs stay on GitHub. See `docs/agents/issue-tracker.md`, and `docs/agents/multica.md` for the workflow and PR linking. Always put the issue ID in the branch name and the PR title (e.g. `agent/mika/issue-12-…`, `ISSUE-12: …`); without it the PR isn't linked and the issue never closes on merge. Merge PRs with squash and merge only (`gh pr merge --squash`).

### Triage labels

Default vocabulary: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Multi-context: a root `CONTEXT-MAP.md` points at one `CONTEXT.md` per workspace. See `docs/agents/domain.md`.

### Changesets

Include a changeset for user-visible changes. Read `.changeset/README.md` before
recording changes or preparing a release.

### Dependencies

A dependency more than one workspace uses is pinned once, in the root `package.json` under `workspaces.catalog`, and each workspace names it as `"catalog:"`: bump it there. `engines.bun` is the Bun version for local installs and CI; the Docker images must use the same one, and `bun run check:infra` fails when they drift.

### CI

QA runs on GitHub for every pull request, and `main` merges only once its required jobs pass; the repo is public, so hosted minutes are unlimited. Before pushing code, run what your change can break: `bun run lint`, `bun run format`, `bun run check-types`, `bun run boundaries`, `bun run test` and `bun run build`, plus `bun run check:infra` (shellcheck, actionlint, the `infra/**/*.test.sh` self-tests and `scripts/with-live.test.mjs`) when you touch infra, scripts or workflows. Integration tests and every browser project run on the PR; when the change can affect them, `bun run test:integration` and the chromium e2e suites give faster feedback locally (see the `local-ci` skill). Running QA's `checks` job in a container with local-ci is optional: `bunx run-local-ci run --quiet -w .github/workflows/qa.yml --pause-on-failure`; its `workflows` job always pauses at `test:integration` there, so abort it, and never run another workflow with local-ci. If a check fails on the PR, fix and push until it passes; don't report the work as done before then. Skip the local checks for changes that only touch `**.md` or `docs/**`.

## Frontend apps

Every app under `apps/` runs its dev server through the shared wrapper, so
impeccable live is attached in plain `bun dev`:

```json
"dev": "node ../../scripts/with-live.mjs vite dev",
"dev:plain": "IMPECCABLE_LIVE=0 vite dev"
```

`scripts/with-live.mjs` boots the live helper, writes a default
`.impeccable/live/config.json` when the app doesn't have one yet (TanStack Start
and plain-Vite shells are recognised), then runs the dev command and strips the
injected script again on exit. A new frontend needs the two script lines and
nothing else — the helper itself lives in the untracked `.agents/skills/impeccable`,
so a machine without that skill installed just prints `impeccable live
unavailable` and runs Vite plainly.

**The injection is a working-tree thing and must never be staged.** While `bun
dev` runs, every app's `src/routes/__root.tsx` carries an
`import ImpeccableLiveRoot` plus its JSX block, and the component it points at is
gitignored — so a commit taken mid-session is a tree that cannot build. The
`scripts/check-live-staged.sh` guard refuses such a commit through hk; the root
`prepare` script runs `hk install`. See `docs/agents/git-hooks.md` for setup.

Each running frontend gets its own Live helper port, so `turbo run dev` can
attach Live to several apps at once. A Live session still belongs to one app;
open that app's route before selecting elements.

UI implementation routes through skills: `animate` for new motion,
`fixing-motion-performance` for janky motion, `better-accessibility` for keyboard, focus and
ARIA work (dropdowns, menus, dialogs, custom widgets), `shadcn` for adding or changing `packages/ui` components. Load the matching skill
before writing the code.

`hallmark` is for new marketing sites and standalone pages only. Product screens in `apps/` and `domains/` are built from `@repo/ui` and the Tagaroa design system (`docs/agents/design-system.md`), so never use `hallmark` there unless the user names it.

## Architecture notes

Read the matching file before working in that area; they are not loaded automatically.

- `docs/agents/design-system.md`: the Tagaroa design system artifact, the `@repo/ui` import map, and where product styling lives. Read before building a screen from a design, or before editing anything under `packages/ui`.
- `docs/agents/workspace-domains.md`: the workspace shell, microfrontends proxy, ports, and how to add a domain front end. Read before adding or changing a front end under `apps/` or `domains/`, `microfrontends.json`, or `packages/shell`.
- `docs/agents/administration.md`: identity vs domain administration, `AccessControlModule`, and what is built. Read before touching `apps/admin`, `servers/core` access-control or directory code, or admission/role logic in `packages/shell`.
- `docs/agents/api.md`: `servers/core` HTTP conventions: envelope, collections, status codes, request validation with Zod. Read before adding or changing an endpoint.
- `docs/agents/multica.md`: how coding agents run against this repo through Multica: agents, workflow, PR linking, autopilots. Read before changing `.github/workflows/qa.yml`'s `notify-multica` job or an agent skill.

<!-- BEGIN:turborepo-agent-rules -->

# This is NOT the Turborepo you know

Turborepo configuration, task behavior, and CLI commands can vary between installed versions and may differ from your training data. Resolve the `turbo` package from this file's directory or relevant workspace; in monorepos, it may not be visible from the repository root. For example, run `node -p "require.resolve('turbo/package.json')"` from a workspace that depends on `turbo`.

Read `docs/README.md` inside that installed package first, then read the relevant pages from its `docs/` directory before changing Turborepo configuration or commands. Heed deprecation notices. These bundled docs match the installed package version and are available without network access.

This block is written and re-added by `turbo` before repository-scoped commands when an AI agent is detected. In the Turborepo source repository, its template is defined in `crates/turborepo-cli/src/cli/agent_guidance.rs`. Removing the managed block while updates are enabled means a later qualifying invocation will add it again. Set `"agentGuidance": false` in the root `turbo.json` or `turbo.jsonc` to opt out; this does not remove an existing block. Keep the block committed with your work to avoid an uncommitted change on the next agent invocation.
<!-- END:turborepo-agent-rules -->
