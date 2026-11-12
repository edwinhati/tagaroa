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
- **Response types.** What an endpoint answers with is declared once in `@repo/contracts`
  (`access-control`, `directory`, `identity`, `notifications`), with `Date` fields as core builds
  them. Core's ports and services use those types, so a renamed or dropped field fails core's type
  check. The apps read them as `Wire<T>`, where every `Date` is an ISO string.
- **Collections.** Offset paging only: `page` (from 1) and `limit` (default 25, max 100). Build the
  query with `parseCollectionQuery` and the reply with `pageCollection` / `collectionOf`
  (`platform/http/collection.ts`). Sorting is an allow-list (`sort=-name,id`), filters list their
  allowed values, search is `q`. A sort field or filter value outside its list is a 400; a `page`
  or `limit` that is not a positive integer falls back to its default, and a `limit` over 100 is
  clamped, not refused. The endpoint's `defaultSort` follows the request's sort, and a field is
  sorted by once (the first mention wins). Several collections on one URL take a `prefix`
  (`teamsPage`, `teamsLimit`).
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
  Three bodies differ from that shape (`platform/http/error-envelope.test.ts`):
  - A request with no session is `401 { statusCode, message: "Unauthorized" }`, without `error`.
  - A route `AccessControlGuard` denies is `403 { code: "ACCESS_DENIED", message }`, without
    `statusCode` or `error`.
  - An unexpected error is `500 { statusCode, message: "Internal server error" }`. The thrown
    message never reaches the body.

## Request bodies: validate with Zod

Declare a schema on the parameter with Nest's `schema` option instead of reading the body as
`unknown` and checking fields by hand:

```ts
@Post("assignments")
@Roles(["admin", "super-admin"])
async grantAssignment(
  @Body({ schema: grantAssignmentBody }) body: GrantAssignmentBody,
  @Session() session: UserSession,
) {
  return { data: await this.access.grantAssignment(body, operatorOf(session)) };
}
```

- The decorator only attaches the schema. Nest's `StandardSchemaValidationPipe`, bound once as
  `APP_PIPE` in `AppModule` (`schemaValidation`, `platform/http/schema-validation.ts`), does the
  parsing. A parameter with no schema passes through untouched. A module that mounts a controller
  without `AppModule` (a test, a second entrypoint) must bind `schemaValidation` the same way, or
  its handlers receive the raw value (see `directory.controller.test.ts`).
- The schema holds the field rules and their sentences, and its output is the type the service
  takes. Schemas for bodies an app sends live in `@repo/contracts/requests/*` (`access-control`,
  `auth-management`, `directory`, `notifications`), with the field helpers in `requests/fields`.
  The app types what it sends as `Wire<XBody>` with a type-only import, so Zod stays out of its
  bundle. See `requests/access-control.ts` for the worked example (trim, cross-field rule, parsed
  date).
- A failure is a 400 with `message` (the first issue) and `details: [{ field, message }]` for a
  form that wants to show errors beside inputs.
- Before parsing, the pipe strips `__proto__`, `prototype` and `constructor` keys at any depth.
- Domain rules (a role cannot be assigned at that scope, a user is not a member) stay in the
  service. A schema checks shape; it does not replace those.
- Keep Zod's key order meaningful: issues are reported in the order the keys are declared.
- A query object is parsed the same way (`@Query({ schema })`), and so is a route parameter
  (`@Param("id", { schema })`).
- Every `access-control` route, the `PUT /directory/positions/...` routes, the
  `auth-management` writes, and template writes in `notification.admin.controller.ts` parse their
  bodies this way. Template shape rules live in `requests/notifications.ts`; domain rules stay
  in `TemplateDraft`. Move other controllers over when you touch them; do not convert them in one
  sweep.
- Signed webhooks verify their signatures over the raw bytes, then parse the decoded body with
  `parseWith(schema, request.body)` (same parse, same 400). Never declare `@Body({ schema })` on
  a webhook: the global pipe would parse the body before the signature is checked.

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
