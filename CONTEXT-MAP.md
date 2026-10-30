# Context Map

Tagaroa is a multi-context monorepo. Each context is a workspace declared in the root
`package.json` (`apps/*`, `domains/*`, `packages/*`, `servers/*`). This file is the index: it
names each context, what it owns, and where its `CONTEXT.md` lives.

Which directory a front end belongs in is decided by one question: **is it a working domain
of the workspace?** A domain is a microfrontend — declared in
`apps/workspace/microfrontends.json`, mounted by the proxy at `/<slug>`, wearing the shared
chrome — and lives in `domains/`. Everything else is a standalone app on its own origin and
lives in `apps/`: `apps/auth` is the door, `apps/workspace` is the proxy's default
application and the shell, `apps/admin` is the back office.

Per-context `CONTEXT.md` files are written lazily by `/domain-modeling`, when terminology
actually needs pinning down. A context marked _(not yet written)_ has no glossary; read the
code and this entry instead.

## Contexts

| Context            | Package                      | Owns                                                                                                                                                                                                                                                                                                                                                                                                                                                              | Glossary                                             |
| ------------------ | ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| Core service       | `servers/core`               | NestJS + Bun HTTP server. Better Auth owns identity, organizations, teams and sessions. `access-control` owns code-defined business permissions, custom roles, scoped assignments and break-glass; `directory` owns descriptive positions and the group-wide read. `audit` owns the shared audit trail. `notification` sends email, SMS and WhatsApp and owns its templates, messages and suppressions. App-owned data stays outside the generated `auth` schema. | `servers/core/CONTEXT.md`                            |
| Auth app           | `apps/auth`                  | TanStack Start front end for sign-in / sign-up flows against the core service.                                                                                                                                                                                                                                                                                                                                                                                    | `apps/auth/CONTEXT.md` _(not yet written)_           |
| Workspace shell    | `apps/workspace`             | TanStack Start shell behind the door: admission, chrome, and the domain index. Default application of the microfrontends proxy (`microfrontends.json`), so it also owns every unmatched path.                                                                                                                                                                                                                                                                     | `apps/workspace/CONTEXT.md` _(not yet written)_      |
| Engineering domain | `domains/engineering`        | The engineering domain's front end, mounted by the proxy at `/engineering`. Owns its routes and nothing else.                                                                                                                                                                                                                                                                                                                                                     | `domains/engineering/CONTEXT.md` _(not yet written)_ |
| Admin app          | `apps/admin`                 | TanStack Start back office on its own origin (`3003`), with its own chrome. Manages people, identity safety, subsidiaries, positions, business roles and scoped assignments. Reached by identity role, not by team — not a domain, so not behind the proxy.                                                                                                                                                                                                       | `apps/admin/CONTEXT.md`                              |
| Workspace chrome   | `packages/shell`             | `@repo/shell`: the header and domain rule every workspace app wears, the domain list, the auth client, and admission (`admit()`).                                                                                                                                                                                                                                                                                                                                 | `packages/shell/CONTEXT.md` _(not yet written)_      |
| Design system      | `packages/ui`                | `@repo/ui`: shared React components (shadcn over Base UI), Tailwind styles, hooks. Consumed by every app.                                                                                                                                                                                                                                                                                                                                                         | `packages/ui/CONTEXT.md` _(not yet written)_         |
| TS config          | `packages/typescript-config` | `@repo/typescript-config`: shared `tsconfig` bases. No domain language.                                                                                                                                                                                                                                                                                                                                                                                           | —                                                    |

## Placeholders

These directories exist but hold no code yet. Treat them as intent, not as contexts:

- `apps/docs` — planned front end, currently empty.
- `domains/{finance,industry,logistic,marketing,operation,research,sales,supply-chain}` —
  one front end per working domain, each mounted by the proxy at `/<domain>` and listed in
  `apps/workspace/microfrontends.json` with a port from 3010 upward. Still empty; the shell
  shows them as planned doors. `domains/engineering` is the built one — copy it. `products/{enterprise,flow,lumen}`, `agents/` — reserved
  namespaces, currently empty.

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
  in. Not "control plane", not "dashboard", not "admin panel". `apps/auth` is its door,
  `apps/workspace` is its shell.
- **Domain** — a working area of the group (engineering, finance, sales, …), one front end
  per domain under `domains/`, composed into the workspace at `/<domain>`. A domain is not
  an organization: organizations are subsidiaries, domains are kinds of work. A person sees
  the domains matching the **teams** they belong to, by name, and no others. Being a domain is
  what puts a front end in `domains/` and in the proxy; `apps/admin` is neither, because it is
  reached by role rather than by team.
- **Organization** — the tenant. Users belong to organizations through a **member** record; users cannot create organizations themselves, and organizations are not deletable.
- **Team** — a subdivision of an organization, joined through a **team member** record. There is no default team.
- **Session** — an authenticated browser session.
- **Account** — a credential record (email/password or a provider) linked to a user; distinct from **user**, the person.
- **Personal address** — `user.personalEmail`: where onboarding and a reissued password are
  delivered, because staff mail lives inside the workspace and cannot be read by someone who
  cannot yet sign in. Required to issue an account; never returned by any route, and read one
  person at a time through `directory`. Distinct from the person's **address**, which is the
  workspace one they sign in with.
- **Temporary password** — the password an admin issues when creating an account or
  restoring access. Flagged by `user.mustChangePassword` and replaced on first sign-in; see
  `docs/adr/0001-admin-managed-accounts.md`.
- **Super-admin** — a group-level role that can restore access in any subsidiary, and mint
  accounts directly. Break-glass; see `docs/adr/0001-admin-managed-accounts.md`.

All of the above are Better Auth concepts, persisted in the PostgreSQL `auth` schema
(`servers/core/src/modules/auth/infrastructure/persistence/drizzle/schema.ts`). Do not rename
them in code or in issues; use these words.
