# tagaroa

Bun + Turborepo monorepo. Workspaces: `apps/*`, `packages/*`, `servers/*`.

## Agent skills

### Issue tracker

Issues live as GitHub issues in `edwinhati/tagaroa`, managed with the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Default vocabulary: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Multi-context: a root `CONTEXT-MAP.md` points at one `CONTEXT.md` per workspace. See `docs/agents/domain.md`.

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

## Architecture notes

Read the matching file before working in that area; they are not loaded automatically.

- `docs/agents/design-system.md`: Claude Design bundle, `@repo/ui` import map, and where product styling lives. Read before pasting a Claude Design screen into the repo, or before editing anything under `packages/ui`.
- `docs/agents/workspace-domains.md`: the workspace shell, microfrontends proxy, ports, and how to add a domain front end. Read before adding or changing a front end under `apps/` or `domains/`, `microfrontends.json`, or `packages/shell`.
- `docs/agents/administration.md`: identity vs domain administration, `AccessControlModule`, and what is built. Read before touching `apps/admin`, `servers/core` access-control or directory code, or admission/role logic in `packages/shell`.

<!-- BEGIN:turborepo-agent-rules -->

# This is NOT the Turborepo you know

Turborepo configuration, task behavior, and CLI commands can vary between installed versions and may differ from your training data. Resolve the `turbo` package from this file's directory or relevant workspace; in monorepos, it may not be visible from the repository root. For example, run `node -p "require.resolve('turbo/package.json')"` from a workspace that depends on `turbo`.

Read `docs/README.md` inside that installed package first, then read the relevant pages from its `docs/` directory before changing Turborepo configuration or commands. Heed deprecation notices. These bundled docs match the installed package version and are available without network access.

This block is written and re-added by `turbo` before repository-scoped commands when an AI agent is detected. In the Turborepo source repository, its template is defined in `crates/turborepo-cli/src/cli/agent_guidance.rs`. Removing the managed block while updates are enabled means a later qualifying invocation will add it again. Set `"agentGuidance": false` in the root `turbo.json` or `turbo.jsonc` to opt out; this does not remove an existing block. Keep the block committed with your work to avoid an uncommitted change on the next agent invocation.
<!-- END:turborepo-agent-rules -->
