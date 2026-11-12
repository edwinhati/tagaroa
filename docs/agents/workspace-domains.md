# The workspace and its domains

`apps/workspace` is the shell staff land on after signing in, and the default application
of Turborepo's [microfrontends proxy](https://turborepo.dev/docs/guides/microfrontends). Each
working domain is its own front end under `domains/<slug>`, mounted at `/<slug>`.

`turbo dev` reads `apps/workspace/microfrontends.json` and puts every running app behind
one origin: the proxy on `localhost:3000`, the shell on `3002`, domains from `3010` up. A
domain declared there without a package is a warning, not an error — the path simply does
not route yet.

**`domains/` is for microfrontends; `apps/` is for standalone apps.** A working domain goes
in `domains/`, is declared in `microfrontends.json`, and is composed into the workspace's
origin wearing `@repo/shell`'s chrome. Anything that is not a domain gets its own origin and
lives in `apps/` — `apps/auth` (the door, `3001`), `apps/workspace` (the shell and the
proxy's default application, `3002`), `apps/admin` (the back office, `3003`).

**The port says which.** `apps/` takes `3001`–`3009`, `domains/` takes `3010` upward, and the
proxy itself keeps `3000`. A new standalone app and a new domain therefore never collide, and
neither has to displace the other to be added.

`apps/admin` is standalone for that reason: it is reached by role (`admin`, `super-admin`)
rather than by team, so it is not a domain. It is absent from `microfrontends.json` and from
`packages/shell/src/domains.ts`, wears its own chrome, and is linked from the workspace
header by URL (`VITE_ADMIN_URL`) rather than by path. Its origin must be in the core
service's `TRUSTED_ORIGINS` and in the door's `VITE_TRUSTED_REDIRECT_ORIGINS`. It reads the
group through `servers/core`'s `GET /api/directory`, because Better Auth's organization
endpoints answer only for teams the caller is in.

`domains/engineering` is the worked example — copy it. To add another domain front end:

1. Copy `domains/engineering` to `domains/<slug>` as `@domains/<slug>`, replacing
   `engineering` in `vite.config.ts` (`base`), `src/routes/_shell.tsx` (`current` and the
   `admit(…, "<slug>")` call), and `src/routes/__root.tsx` (the `documentHead` title and
   `AppDocument app="domains/<slug>"`). The router (`@repo/shell/router`) takes its base path
   from `base`, and the Vite setup (`@repo/shell/vite`) reads the app's port from
   `microfrontends.json` by its package name.
2. Mark the domain live in `packages/shell/src/domains.ts` (the `live` rule names the built
   domains).
3. Serve it in production: add `domains/<slug>` to both app loops and the `COPY` lines in
   `infra/web/Dockerfile`, and a `handle /<slug>*` block in `infra/web/Caddyfile`.

The port and the path already exist in `microfrontends.json`; `domains.ts` is the same list
in TypeScript and the two are kept in step by hand.

The chrome is not copied: `@repo/shell` owns the header, the domain rule, admission
(`admit()`), the session query, the router and the Vite setup. A domain wears
`WorkspaceShell`; the workspace and the back office wear `AppShell`. A domain app owns its
routes and nothing else.

The rule is per person, not per repo: `admit()` reads the signed-in person's domain
memberships from `GET /api/access-control/domains`. Server-owned team-id/domain-slug
bindings determine admission; team display names grant nothing. Link a team to its domain
in Subsidiaries. Current team and subsidiary membership are required, and renaming the
team preserves its link. `packages/contracts` owns the domain catalog; the shell adds live
flags and display order. Migration `0015` preserves recognized legacy names once.
