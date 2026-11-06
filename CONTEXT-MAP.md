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

| Context            | Package                      | Owns                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | Glossary                                             |
| ------------------ | ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| Core service       | `servers/core`               | NestJS + Bun HTTP server under `/api`. Better Auth owns identity, organizations, teams, sessions and impersonation; `auth` also owns factor recovery and the account lifecycle other modules drive. `access-control` owns code-defined business permissions, custom roles, scoped assignments, break-glass, business access reviews and team → domain bindings; `directory` owns descriptive positions, privileged access reviews and the group-wide read. `audit` owns the shared audit trail. `hr` turns Frappe HR records into joiners and leavers. `notification` sends email, SMS and WhatsApp, owns its templates, messages and suppressions, and takes provider delivery receipts. App-owned data stays outside the generated `auth` schema. | `servers/core/CONTEXT.md`                            |
| Auth app           | `apps/auth`                  | TanStack Start front end on `3001`: the door. Sign-in (password or passkey), the second factor, the temporary-password change, re-authentication before sensitive actions, and the locked-out page. There is no self sign-up; accounts are issued.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | `apps/auth/CONTEXT.md` _(not yet written)_           |
| Workspace shell    | `apps/workspace`             | TanStack Start shell behind the door: admission, chrome, and the domain index. Default application of the microfrontends proxy (`microfrontends.json`), so it also owns every unmatched path.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | `apps/workspace/CONTEXT.md` _(not yet written)_      |
| Engineering domain | `domains/engineering`        | The engineering domain's front end, mounted by the proxy at `/engineering`. Owns its routes and nothing else.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | `domains/engineering/CONTEXT.md` _(not yet written)_ |
| Admin app          | `apps/admin`                 | TanStack Start back office on its own origin (`3003`), with its own chrome. Manages people, identity safety, subsidiaries and their teams' domain bindings, positions, business roles, scoped assignments, access reviews and notifications. Reached by identity role, not by team — not a domain, so not behind the proxy.                                                                                                                                                                                                                                                                                                                                                                                                                         | `apps/admin/CONTEXT.md`                              |
| Workspace chrome   | `packages/shell`             | `@repo/shell`: the header and domain rule every workspace app wears, the domain list, the auth client, account security (authenticator setup), the impersonation notice, and admission (`admit()` for the workspace and domains, `admitAdmin()` for the back office).                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | `packages/shell/CONTEXT.md` _(not yet written)_      |
| Contracts          | `packages/contracts`         | `@repo/contracts`: the shapes that cross the core ↔ app boundary — the response envelope, the collection, guards for `unknown` values, and `WORKING_DOMAINS`, the one list of domain slugs.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | —                                                    |
| Email              | `packages/email`             | `@repo/email`: the branded React Email shell and theme that notification email is rendered in, shared by the core service and the admin app's template preview.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | —                                                    |
| Design system      | `packages/ui`                | `@repo/ui`: shared React components (shadcn over Base UI), Tailwind styles, hooks. Consumed by every app.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | `packages/ui/CONTEXT.md` _(not yet written)_         |
| Test support       | `packages/test-support`      | `@repo/test-support`: shared test helpers (TOTP codes for MFA flows, the Playwright axe route audit). No domain language.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | —                                                    |
| TS config          | `packages/typescript-config` | `@repo/typescript-config`: shared `tsconfig` bases. No domain language.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | —                                                    |

## Placeholders

These are declared but hold no code yet. Treat them as intent, not as contexts:

- `finance`, `industry`, `logistic`, `marketing`, `operation`, `research`, `sales`,
  `supply-chain` — working domains listed in `WORKING_DOMAINS` (`@repo/contracts`) and in
  `apps/workspace/microfrontends.json` with a port from 3011 upward, but with no
  `domains/<domain>` directory yet. The shell shows them as planned doors.
  `domains/engineering` is the built one — copy it.

Add a row above when one of them gains a `package.json`.

## Cross-cutting

- `infra/` — not a workspace: `docker/` is local PostgreSQL and the Drizzle gateway
  (`docker compose`); the rest is deployment and ops.
- `scripts/` — shared dev tooling every app's `dev` script runs through (`with-live.mjs`).
- `tests/exploration` — cross-app exploration suites; each app keeps its own e2e tests.
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
  the domains their **teams** are bound to, and no others. A team is bound to at most one
  domain by an operator (`access-control`'s team → domain binding); a team's display name
  decides nothing. Being a domain is
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
- **Impersonation** — a super-admin signed in as another person, through Better Auth's admin
  plugin (`session.impersonatedBy`). The session may read and stop impersonating, nothing
  else, and every workspace app shows a persistent notice while it lasts.

All of the above are Better Auth concepts, persisted in the PostgreSQL `auth` schema
(`servers/core/src/modules/auth/infrastructure/persistence/drizzle/schema.ts`). Do not rename
them in code or in issues; use these words.
