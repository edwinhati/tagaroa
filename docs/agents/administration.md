# Administration, and why `apps/admin` hosts nothing

Two kinds of administration, two homes, no overlap:

- **Identity** — accounts, roles, suspensions, sessions, subsidiaries, teams — is group-wide and
  lives only in `apps/admin`.
- **Domain configuration** — one domain's own settings — lives in that domain's own front
  end at `/<slug>/admin`, behind the workspace proxy, wearing the domain's chrome, gated by
  role.

`apps/admin` is **not** a second microfrontends host, and a domain's admin surface is **not**
a separate package. Two facts make that architecture unavailable rather than merely
unattractive: `turbo dev` starts exactly one proxy per invocation (two `microfrontends.json`
files leave one of them silently dead), and a `domains/<slug>` package cannot mount twice
because Vite's `base` (which the router's base path follows) is a build-time constant against
one dev port. Do not propose it again without re-testing both.

**Built:**

- `AccessControlModule` owns business authorization in the hand-written `access_control`
  schema: code-owned permissions, custom roles, subsidiary/team assignments and
  session-bound break-glass elevation. Better Auth's `AuthModule` still owns identity,
  sign-in, sessions, MFA, organizations and teams.
- `domain:administer` is the first permission. The built-in Domain administrator role may
  be assigned per subsidiary or team. A subsidiary assignment reaches its child teams;
  a team assignment is narrow. Effective access also requires current membership and MFA.
- Privileged grants require a super-admin and a session authenticated within 15 minutes.
  Emergency access is explicit, reasoned, limited to one permission/scope for 15 minutes,
  and audited on activation and use.
- `directory.person_position` stores descriptive titles and reporting lines at group or
  subsidiary scope. A position never grants access. Reporting cycles are rejected.

  Note for anything new: `@Body()` **does** work outside `/api/auth`. The app is created with
  `bodyParser: false` for Better Auth's sake, but `@thallesp/nestjs-better-auth` re-enables
  Express's JSON and urlencoded parsers on every other route. `AuthModule` also passes
  `bodyParser: { rawBody: true }`, which keeps the undecoded JSON bytes on the request —
  the notification webhooks verify provider signatures against those, since a parse and
  re-serialise does not reproduce the bytes that were signed.
  A domain app asks `GET /api/access-control/me` for the person in front of it. The shell's
  `isDomainAdmin(session, slug, memberships)` still refuses anyone `isAdmitted()`
  refuses, then matches only teams for which that effective permission check succeeded.
  Identity `admin` and `super-admin` roles do not silently bypass business access.

- `apps/admin` → Roles & access manages custom roles, scoped assignments and explicit
  emergency access. Person details manages titles and reporting lines separately.

**Not built:** `/<slug>/admin` itself. No domain has configuration yet; the route arrives with
the first real setting.
