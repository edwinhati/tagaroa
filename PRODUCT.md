# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary: people who run Tagaroa — staff of the holding company and of its operating
subsidiaries. They arrive at `apps/auth` from an onboarding email or from a workspace
app that bounced them out, sign in, and are redirected onward. They are doing operating
work (business, engineering, finance, operations), not evaluating a product.

Not served by this surface: customers of the owned products (`products/enterprise`,
`products/flow`, `products/lumen`). Those get their own auth surface later; do not design
`apps/auth` as a public front door.

Nobody self-registers. An admin creates the account with a temporary password, which the
employee must replace on first sign-in; `/sign-up/email` is closed entirely. See
`docs/adr/0001-admin-managed-accounts.md`.

## Product Purpose

Tagaroa is an operating holding company (named for the Austronesian god of the sea). It
owns and runs real operating subsidiaries; software is how those businesses run. This
monorepo holds the internal **workspace** that runs the group, plus the **owned products**
the group sells. "Workspace" is the name staff use for the internal system; do not call it a
control plane, a dashboard, or an admin panel in copy or in code.

`apps/auth` is the workspace's single door. Success is a staff member getting from an
onboarding email or a cold visit into the app they were headed for, with no dead ends and no
uncertainty about which account or organization they are operating as.

## Positioning

The organizations in this system are the group's actual operating subsidiaries, not
customer accounts. That is why no user can create an organization and no organization can
be deleted: the org list is a fact about the company, mirrored into software, not a
self-serve signup artifact. Teams subdivide a subsidiary.

## Operating Context

- Entry is by onboarding email or by redirect from another workspace app.
- After sign-in, `apps/auth` hands off to `apps/workspace`. It owns no product UI of its
  own beyond the auth flows.
- The workspace is not one app. `apps/workspace` is the shell — it owns the chrome, the
  session and every unmatched path — and each working domain (`domains/engineering`,
  `domains/finance`, `domains/industry`, `domains/logistic`, `domains/marketing`,
  `domains/operation`, `domains/research`, `domains/sales`, `domains/supply-chain`) is its
  own front end mounted at its own path. Turborepo's microfrontends proxy composes them
  behind one origin in development (`apps/workspace/microfrontends.json`); production
  composition is undecided.
- An operator therefore meets one workspace, never nine apps. A domain that has no front
  end yet is a planned door, not a missing page — say so rather than 404ing.
- Nobody meets the nine. A person is shown the domains they work in — the teams they belong
  to in the core service, matched to the domain registry by name — and no evidence that the
  rest exist. Someone in engineering alone sees one label.
- In development the proxy is `localhost:3000` (what a person opens), the shell
  `localhost:3002`, the back office `localhost:3003`, the door `localhost:3001`, each domain
  `3010` upward, and the core
  service `localhost:8080`. Both the door's and the proxy's origins must be listed in the
  core service's `TRUSTED_ORIGINS`, and the proxy's origin in the door's
  `VITE_TRUSTED_REDIRECT_ORIGINS` — a hand-off to an untrusted origin is silently dropped.
- A person may hold up to 3 concurrent sessions across accounts.

## Capabilities and Constraints

Confirmed for v1 in `apps/auth`:

- **Sign in** — email and password.
- **First sign-in** — sign in with the temporary password from the onboarding email, then
  replace it before reaching the workspace.
- **Password recovery** — a screen telling the employee how to reach an admin. There is no
  reset-link flow: the admin sets a new password directly, and it reaches the employee at
  their personal address.

Explicitly out of scope for v1: self-serve sign up (there is no public registration) and
account switching.

Confirmed for v1 in `apps/workspace`:

- **Admission** — the shell resolves the session before it renders anything. No session, or
  a session still on a temporary password, and the operator is sent back to the door with
  the way back in `?redirect=`.
- **The domains** — the ones this person works in, and which of those have a front end yet.
- **Identity and sign-out** — who is signed in, and the way out.
- **Theme** — the same three-state control the door carries.

Out of scope for v1 here: any domain's own screens (they belong to `domains/*`), an
organization or team picker, and search. Membership decides what is _shown_, not what is
_reachable_ — a domain app is not yet closed to someone who types its path.

Confirmed for v1 in `apps/admin` (the back office: its own origin on `3003`, outside the
microfrontends proxy, reached by role rather than by team, and wearing its own chrome so
nobody mistakes it for their own work):

- **People** — every account in the group, with its role, standing (active, banned, or still
  on a temporary password) and the domains its teams give it. Issue an account, which
  generates the temporary password and shows it once; reissue one to restore access, which
  also ends every session they hold; make or unmake an admin; revoke every session; ban and
  lift a ban.
- **Subsidiaries** — the operating companies, the teams inside them, and who is in each.
  This is where the workspace's domain rule is decided: a team named after a domain puts
  that domain on its members' rule, and a team named after nothing is marked as such.

Out of scope for v1 here: creating a subsidiary or a team (both are company facts, made in
the core service), impersonation, an audit log, and a session list per person. Hiding is not
gating: the rail and the role check are courtesy, and the core service refusing the admin
endpoints is the enforcement.

Better Auth's organization endpoints answer as the signed-in member — `/organization/list`
returns only the caller's subsidiaries and `/organization/list-team-members` refuses a caller
who is not in the team. An admin's whole job is the teams they are not in, so `servers/core`
serves `GET /api/directory` behind the same role. Writes still go through Better Auth.

### Two kinds of administration

The plumbing is built; the room is not. A scoped Domain administrator assignment can be
made today, and `isDomainAdmin()` answers from effective business permissions — but no
domain has configuration to administer yet, so `/<domain>/admin` arrives with the first
real setting rather than standing empty.

Administration splits in two, by what is being administered, and the two never overlap:

- **Identity** — accounts, roles, bans, sessions, subsidiaries, teams. Group-wide, dangerous,
  and the same everywhere. It lives in `apps/admin` and nowhere else.
- **Domain configuration** — one domain's own settings. It is that domain's data with a lock
  on it, so it lives in that domain's own front end, at `/<domain>/admin`, behind the
  workspace proxy and wearing the domain's chrome.

A **Domain administrator** is a custom business role containing the code-owned
`domain:administer` permission. An assignment may cover one subsidiary and all its child
teams, or one team only. Tagaroa Core's Engineering and another subsidiary's Engineering
are therefore separate scopes. It permits editing that domain's configuration and nothing
else — not membership, accounts, or unrelated domains.

Identity roles and business access are intentionally separate. Being an `admin` or
`super-admin` opens the back office; it does not silently pass a domain's business gate.
A super-admin can recover access only through explicit break-glass: one permission and
scope, a written reason, the current session, and a 15-minute lifetime, all audited.

Membership and access assignment are separate records, but effective access requires both.
Leaving a subsidiary or team makes the assignment inactive immediately without erasing its
history. Privileged assignments likewise become inactive when the assignee no longer has
two-factor authentication.

A person's **position** and reporting manager describe company hierarchy but grant no
access. Access comes only from a role assignment, so changing a title cannot accidentally
change what the person may do.

Core service truth this surface must honor (`servers/core/src/modules/auth/auth.ts`):

- `user.mustChangePassword` is set when an admin issues a password and cleared by an `after`
  hook on `/change-password`. It is `input: false`, so no client can write it.
- Sign-in must honour that flag before handing off to any workspace app.

- Passwords are 12–256 characters; state the rule before the user fails it.
- Breached-password rejection (haveibeenpwned) is active in production only — a password
  can be refused for being publicly breached, and the UI must be able to say so.
- Better Auth plugins in use: `admin`, `organization` (teams on, default team off, org
  creation disabled, org deletion disabled), `openAPI`.
- Auth data lives in the PostgreSQL `auth` schema via Drizzle.

**The workspace sends no email to workspace addresses.** Staff mail is planned to live
inside the workspace, so a message sent there could only be read by someone who can already
sign in. Both messages the workspace sends to a member of staff go to their **personal**
address instead: onboarding, carrying the workspace address and a temporary password, and a
reissued password when an admin restores access. Neither can be delivered without one on
file, which is why issuing an account requires it. See
`docs/adr/0001-admin-managed-accounts.md`.

That rule is about staff addresses, not about messaging in general. `servers/core`'s
`notification` module sends email, SMS and WhatsApp to whatever address or number a caller
passes it, which is how the group reaches people outside it.

**No reset link, ever.** Recovery is an admin issuing a new temporary password, which the
same module delivers to the personal address; there is no self-service link, no reset token,
and no page that accepts one.

A **group-level super-admin** exists as break-glass for a locked-out organization admin.

Open decisions, not to be invented:

- Email verification is not configured, and is not needed while nothing is emailed.
- Two-factor authentication is not installed. It should be, for the super-admin role.
- A person who belongs to several organizations or teams has no picker yet; the shell names
  the operator, not the subsidiary they are acting for. Deciding that is what turns the
  header from an identity line into a switcher.
- Production composition of the microfrontends (a reverse proxy in `infra/`, or Vercel's
  `@vercel/microfrontends`) is undecided. Turborepo's proxy is development only.

## Brand Commitments

- Product name: **Tagaroa** — the Austronesian god of the sea. The name's origin is the
  only brand fact confirmed so far; no logo, palette, typography, or voice has been
  established.
- Shared UI lives in `@repo/ui` (shadcn components over Base UI, Tailwind). `apps/auth`
  does not depend on it yet.

## Evidence on Hand

- Working core service with real auth wiring: `servers/core` (NestJS + Better Auth + Drizzle).
- Generated auth schema: `servers/core/src/modules/auth/infrastructure/persistence/drizzle/schema.ts`.
- Component library: `packages/ui` (~80 components).
- `apps/auth` is a bare TanStack Start SPA — one route rendering `<h1>Auth</h1>`.
- No logo, brand assets, marketing copy, customer names, testimonials, or metrics exist.
  Do not fabricate any.

## Product Principles

1. **Issued, not registered.** Every account is created by an admin. Never offer a path
   that implies self-serve access.
2. **The door is not the destination.** This surface exists to hand someone off quickly;
   time spent here is overhead, not engagement.
3. **Say the rule before the failure.** Password length, breach rejection, expired
   temporary passwords — surface constraints up front rather than as post-submit errors.
4. **Organizations are company facts.** Reflect them; never offer to create, rename, or
   delete one from this surface.
5. **Don't promise what the backend can't do.** Nothing on this surface sends a message to
   a workspace address — never write copy that implies a reset link is on its way.

## Accessibility & Inclusion

No product-specific standard has been established. This is a credential-entry surface used
under time pressure, so keyboard-only completion and visible focus are treated as baseline
rather than optional.
