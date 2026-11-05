# Authorization for API changes

When adding or changing a Nest route, declare its policy explicitly. The global access guard rejects routes with no declaration.

- Use `@Roles([...])` for group identity operations, with the narrowest role set.
- Use `@RequiresPermission({ permission, organizationParam, teamParam })` for domain business operations. Load the requested record and derive its subsidiary/team from stored data; verify it matches the route scope before returning or changing it. A caller-supplied scope is not proof of record ownership.
- Use `@SessionOnly()` for the signed-in person's own data or effective-access query. Derive the person from the session. Never accept another person's id as authority.
- Use `@AllowAnonymous()` only for a deliberately public endpoint or a provider webhook with signature verification. An authentication exemption requires a documented boundary and a negative test.

An impersonated session may only read: `ImpersonationInterceptor` refuses its writes on every Nest route, and `auth.ts` allowlists what it may reach under `/api/auth`. Better Auth hooks that need the caller resolve it with `requestSession`, which also reads a bearer token. A hook that reads `ctx.context.session` alone treats bearer requests as anonymous.

The guard checks that a requested team belongs to the requested subsidiary before either normal permissions or emergency elevation can authorize it. Business identity roles do not bypass the permission decision. Subsidiary grants inherit across child teams; workspace admission still depends on team membership.

For each new business operation, test unauthenticated access, an authenticated person without permission, another subsidiary/team, a resource belonging to a different scope than the URL, expired/revoked grants, and an allowed request. Verify denied writes leave persisted data unchanged. Keep these tests in the existing unit or HTTP integration suites.

Operational ownership, recovery, employee lifecycle and review procedures live in [access operations](../security/access-operations.md). UI hiding does not replace server enforcement.
