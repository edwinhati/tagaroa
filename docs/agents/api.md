# HTTP API conventions (`servers/core`)

The apps (`apps/*`, `domains/*`) read `servers/core` through `@repo/contracts`. Controllers do
routing, roles and request parsing, and nothing else; each route is one call into one use case or
service. Read this before adding or changing an endpoint.

## In force

- **Prefix, no version.** Every route is under `/api` (`setGlobalPrefix("api")`). There is no
  `/v1`: the apps and the server ship from one repo. Add versioning when a consumer outside this
  repo exists, not before.
- **Envelope.** A single resource answers `{ data }` (`ApiDocument<T>`). A list answers
  `{ data: T[], meta, links }` (`Collection<T>`). Types live in `packages/contracts`.
- **Collections.** Offset paging only: `page` (from 1) and `limit` (default 25, max 100). Build the
  query with `parseCollectionQuery` and the reply with `pageCollection` / `collectionOf`
  (`platform/http/collection.ts`). Sorting is an allow-list (`sort=-name,id`), filters list their
  allowed values, search is `q`. A bad value is a 400. Several collections on one URL take a
  `prefix` (`teamsPage`, `teamsLimit`).
- **Auth on every route.** `@Roles([...])` for a role-gated route, `@SessionOnly()` for any
  signed-in person (the handler must scope the result to that session), `@AllowAnonymous()` only
  for a public route or a signed webhook. See `docs/agents/authorization.md`.
- **Browser safety.** CORS and CSRF both use `TRUSTED_ORIGINS`. CSRF excludes only `auth/*` and
  `notifications/webhooks/*` (`application.ts`); adding to that list is a security decision.
- **Status codes.** 400 for bad input, 401/403 for auth, 404 for a missing resource, 409 for a
  state conflict (duplicate name, stale state). `204` for a webhook acknowledgement and for some
  notification admin actions (`@HttpCode(204)`). Use Nest's exceptions; there is no custom
  exception filter. Validation failures are 400, not 422.
- **Error body.** Nest's default: `{ statusCode, error, message }`. The apps show `message` through
  `messageFor`. Write `message` as a sentence a person can read ("A role already uses that name.").

## Request bodies: validate with Zod

Parse a body with a schema through `ZodBody` (`platform/http/zod-body.ts`) instead of reading it as
`unknown` and checking fields by hand:

```ts
@Post("assignments")
@Roles(["admin", "super-admin"])
async grantAssignment(
  @Body(new ZodBody(grantAssignmentBody)) body: GrantAssignmentBody,
  @Session() session: UserSession,
) {
  return { data: await this.access.grantAssignment(body, actorOf(session)) };
}
```

- The schema holds the field rules and their sentences, and its output is the type the service
  takes. See `access-control.schemas.ts` for the worked example (trim, cross-field rule, parsed
  date).
- A failure is a 400 with `message` (the first issue) and `details: [{ field, message }]` for a
  form that wants to show errors beside inputs.
- Domain rules (a role cannot be assigned at that scope, a user is not a member) stay in the
  service. A schema checks shape; it does not replace those.
- Keep Zod's key order meaningful: issues are reported in the order the keys are declared.
- `POST /access-control/assignments` and the `PUT /directory/positions/...` routes use this so
  far. Move other routes over when you touch them; do not convert the controller in one sweep.

## Not adopted (and why)

- **Cursor pagination, `Link` headers.** Offset is enough at this scale. Revisit if a table grows
  past what `OFFSET` serves well or a screen needs infinite scroll.
- **GraphQL, ETags, batch endpoints, API keys.** No consumer needs them.
- **OpenAPI.** Shared types in `@repo/contracts` serve the apps. Revisit if a partner or a mobile
  client needs a spec.

## Open

- **Rate limiting** applies to Better Auth routes only. Other routes, and the public webhooks in
  particular, have none. `@nestjs/throttler` with a generous global default is the proposed fix.
- **Webhook repeats.** Providers retry. Confirm `hr-webhook` and `notification.webhook` ignore an
  event ID they have already processed.
- **Shared schemas.** `apps/admin/src/lib/admin.ts` re-declares request shapes
  (`grantBusinessAssignment`). Moving a schema into `@repo/contracts` lets both ends share it; that
  needs `zod` added to the package.
