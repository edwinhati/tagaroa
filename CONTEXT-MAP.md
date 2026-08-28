# Context Map

Tagaroa is a multi-context monorepo. Each context is a workspace declared in the root
`package.json` (`apps/*`, `packages/*`, `servers/*`). This file is the index: it names each
context, what it owns, and where its `CONTEXT.md` lives.

Per-context `CONTEXT.md` files are written lazily by `/domain-modeling`, when terminology
actually needs pinning down. A context marked _(not yet written)_ has no glossary; read the
code and this entry instead.

## Contexts

| Context       | Package                      | Owns                                                                                                            | Glossary                                      |
| ------------- | ---------------------------- | --------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| Core service  | `servers/core`               | NestJS + Bun HTTP server. Identity, organizations, teams and sessions via Better Auth; Drizzle over PostgreSQL. | `servers/core/CONTEXT.md` _(not yet written)_ |
| Auth app      | `apps/auth`                  | TanStack Start front end for sign-in / sign-up flows against the core service.                                  | `apps/auth/CONTEXT.md` _(not yet written)_    |
| Design system | `packages/ui`                | `@repo/ui`: shared React components (shadcn over Base UI), Tailwind styles, hooks. Consumed by every app.       | `packages/ui/CONTEXT.md` _(not yet written)_  |
| TS config     | `packages/typescript-config` | `@repo/typescript-config`: shared `tsconfig` bases. No domain language.                                         | —                                             |

## Placeholders

These directories exist but hold no code yet. Treat them as intent, not as contexts:

- `apps/admin`, `apps/workspaces` — planned front ends, currently empty.
- `domains/{business,engineering,finance,operation}`, `products/{enterprise,flow,lumen}`, `agents/` — reserved namespaces, currently empty.

Add a row above when one of them gains a `package.json`.

## Cross-cutting

- `infra/docker` — local PostgreSQL and the Drizzle gateway (`docker compose`), not a workspace.
- `scripts/` — shared dev tooling every app's `dev` script runs through (`with-live.mjs`).
- `docs/adr/` — system-wide decisions. Context-specific decisions live in `<workspace>/docs/adr/`.
- `docs/agents/` — how agents should read this repo: issue tracker, triage labels, domain docs.

## Shared vocabulary

Terms that mean the same thing in every context. Anything context-specific belongs in that
context's `CONTEXT.md`, not here.

- **Workspace** — the internal system this monorepo builds: what staff sign into and work
  in. Not "control plane", not "dashboard", not "admin panel". `apps/auth` is its door.
- **Organization** — the tenant. Users belong to organizations through a **member** record; users cannot create organizations themselves, and organizations are not deletable.
- **Team** — a subdivision of an organization, joined through a **team member** record. There is no default team.
- **Session** — an authenticated browser session.
- **Account** — a credential record (email/password or a provider) linked to a user; distinct from **user**, the person.
- **Temporary password** — the password an admin issues when creating an account or
  restoring access. Flagged by `user.mustChangePassword` and replaced on first sign-in; see
  `docs/adr/0001-admin-managed-accounts.md`.
- **Super-admin** — a group-level role that can restore access in any subsidiary, and mint
  accounts directly. Break-glass; see `docs/adr/0001-admin-managed-accounts.md`.

All of the above are Better Auth concepts, persisted in the PostgreSQL `auth` schema
(`servers/core/src/modules/auth/infrastructure/persistence/drizzle/schema.ts`). Do not rename
them in code or in issues; use these words.
