# tagaroa

Bun + Turborepo monorepo. Workspaces: `apps/*`, `packages/*`, `servers/*`.

## Agent skills

### Issue tracker

Issues live as GitHub issues in `edwinhati/tagaroa-next`, managed with the `gh` CLI. See `docs/agents/issue-tracker.md`.

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
nothing else.

One helper serves port 8400, so two dev servers at once means only the first
gets live — `turbo dev` across several apps included.
