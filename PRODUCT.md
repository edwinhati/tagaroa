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
- After sign-in, `apps/auth` hands off to another app (`apps/workspaces`, `apps/admin`).
  It owns no product UI of its own beyond the auth flows.
- Runs at `localhost:3001` in development; the core service (`servers/core`) at `localhost:8080`
  and must list the auth origin in `TRUSTED_ORIGINS`.
- A person may hold up to 3 concurrent sessions across accounts.

## Capabilities and Constraints

Confirmed for v1 in `apps/auth`:

- **Sign in** — email and password.
- **First sign-in** — sign in with the temporary password from the onboarding email, then
  replace it before reaching the workspace.
- **Password recovery** — a screen telling the employee how to reach an admin. There is no
  reset-link flow: the admin sets a new password directly.

Explicitly out of scope for v1: self-serve sign up (there is no public registration) and
account switching.

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
inside the workspace, so email-based recovery would be circular. Recovery is issued by an
admin instead. The one message the workspace does send is onboarding — an address and a
temporary password, to a new hire's personal address, before they have a workspace mailbox.
See `docs/adr/0001-admin-managed-accounts.md`.

A **group-level super-admin** exists as break-glass for a locked-out organization admin.

Open decisions, not to be invented:

- Email verification is not configured, and is not needed while nothing is emailed.
- Two-factor authentication is not installed. It should be, for the super-admin role.
- Where exactly a user lands after sign-in (which app, and whether an org/team picker is
  needed when a person belongs to several) is undecided.

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
5. **Don't promise what the backend can't do.** The workspace sends no email at all — never
   write copy that implies a message is on its way.

## Accessibility & Inclusion

No product-specific standard has been established. This is a credential-entry surface used
under time pressure, so keyboard-only completion and visible focus are treated as baseline
rather than optional.
