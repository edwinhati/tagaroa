import { asObject } from "@repo/contracts";
import {
  canManageTarget,
  isPrivilegedRole,
  isSuperAdmin,
  mayRun,
  PASSWORD_LENGTH,
  REFUSAL_CODES,
} from "@repo/contracts/identity";
import {
  updateProfileBody,
  type UpdateProfileBody,
} from "@repo/contracts/requests/auth-management";
import {
  APIError,
  createAuthMiddleware,
  getAuthoritativeSessionFromCtx,
} from "better-auth/api";
import { setRequestCookie } from "better-auth/cookies";

import {
  isFresh,
  isRead,
  REFUSALS,
  temporaryPasswordExpired,
  temporaryPasswordRefusal,
} from "./session-policy";

/** What Better Auth's `before` hook refuses beyond its own checks. `validateAdminWrite` runs them all. */

/**
 * The admin routes that hand an employee a temporary password, and the field
 * each one carries it in.
 */
const TEMPORARY_PASSWORD_ROUTES = {
  "/admin/create-user": "password",
  "/admin/set-user-password": "newPassword",
} as const;

const temporaryPassword = (path: string, body: unknown): string | undefined => {
  const field =
    TEMPORARY_PASSWORD_ROUTES[path as keyof typeof TEMPORARY_PASSWORD_ROUTES];
  if (!field) return undefined;
  const password = asObject(body)?.[field];
  return typeof password === "string" ? password : undefined;
};

/**
 * Better Auth enforces the length rules on the routes an employee uses, not on
 * the admin routes that issue a password, so the same rules are applied here.
 * The breach check needs no help: `haveIBeenPwned` already covers both admin
 * paths by default.
 */
export const validateTemporaryPassword = (
  path: string,
  body: unknown,
): void => {
  const password = temporaryPassword(path, body);
  if (password === undefined) return;

  if (password.length < PASSWORD_LENGTH.min) {
    throw new APIError("BAD_REQUEST", {
      code: "PASSWORD_TOO_SHORT",
      message: `Password must be at least ${PASSWORD_LENGTH.min} characters`,
    });
  }
  if (password.length > PASSWORD_LENGTH.max) {
    throw new APIError("BAD_REQUEST", {
      code: "PASSWORD_TOO_LONG",
      message: `Password must be at most ${PASSWORD_LENGTH.max} characters`,
    });
  }
};

/**
 * The routes carrying the address onboarding is delivered to, and whether one
 * is required there.
 *
 * `/admin/create-user` must have it. The message it triggers is the only one the
 * workspace sends to a member of staff, and it cannot go to the workspace
 * mailbox the account does not have yet — that is the loop
 * `docs/adr/0001-admin-managed-accounts.md` exists to prevent. An update may
 * leave the address alone, but may not replace it with nonsense.
 */
const PERSONAL_EMAIL_ROUTES = {
  "/admin/create-user": true,
  "/admin/update-user": false,
} as const;

/**
 * Deliberately loose. A pattern cannot tell a real mailbox from a plausible
 * one, and the delivery attempt is what actually answers that; this only
 * catches the address that was never an address.
 */
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Better Auth does not validate additional fields, so a personal address would
 * otherwise arrive as anything at all — including missing, which would leave an
 * account issued and its holder with no way to hear about it.
 */
export const validatePersonalEmail = (path: string, body: unknown): void => {
  const required =
    PERSONAL_EMAIL_ROUTES[path as keyof typeof PERSONAL_EMAIL_ROUTES];
  if (required === undefined) return;

  const value = asObject(asObject(body)?.data)?.personalEmail;
  if (value === undefined || value === null) {
    if (!required) return;
    throw new APIError("BAD_REQUEST", {
      code: "PERSONAL_EMAIL_REQUIRED",
      message: "A personal email address is required to issue an account",
    });
  }

  if (typeof value !== "string" || !EMAIL_SHAPE.test(value)) {
    throw new APIError("BAD_REQUEST", {
      code: "PERSONAL_EMAIL_INVALID",
      message: "That is not a valid personal email address",
    });
  }

  // The workspace address itself would put the password in the one mailbox
  // the person cannot open yet. An update carries no workspace address to
  // compare against, so only issuing is checked.
  const workspace = asObject(body)?.email;
  if (
    typeof workspace === "string" &&
    workspace.trim().toLowerCase() === value.trim().toLowerCase()
  ) {
    throw new APIError("BAD_REQUEST", {
      code: "PERSONAL_EMAIL_IS_WORKSPACE",
      message:
        "The personal email must differ from the workspace address the account signs in with",
    });
  }
};

/** The account fields `apps/admin` edits; the rest have flows of their own. */
const ADMIN_EDITABLE_USER_FIELDS = new Set([
  "email",
  "name",
  "personalEmail",
  "role",
]);

/**
 * Better Auth's `/admin/update-user` writes any column it is given, so without
 * this one admin could clear `twoFactorEnabled` or `mustChangePassword`.
 */
export const validateAdminUserUpdate = (path: string, body: unknown): void => {
  if (path !== "/admin/update-user") return;
  const data = asObject(asObject(body)?.data) ?? {};
  if (Object.keys(data).every((key) => ADMIN_EDITABLE_USER_FIELDS.has(key)))
    return;
  throw new APIError("BAD_REQUEST", {
    code: "USER_FIELD_NOT_EDITABLE",
    message: "Only the name, email, personal email and role can be changed.",
  });
};

export const expiredTemporaryPassword = () =>
  new APIError("FORBIDDEN", REFUSALS.temporaryPasswordExpired);

const TARGETED_ADMIN_ROUTES = new Set([
  "/admin/list-user-sessions",
  "/admin/set-role",
  "/admin/update-user",
  "/admin/ban-user",
  "/admin/unban-user",
  "/admin/remove-user",
  "/admin/set-user-password",
  "/admin/revoke-user-sessions",
  "/admin/impersonate-user",
]);

/** Whether a role change takes super-admin away from someone who holds it. */
export const removesSuperAdminRole = (
  currentRole: string | null | undefined,
  nextRole: unknown,
): boolean =>
  isSuperAdmin(currentRole) &&
  ![nextRole]
    .flat()
    .some((role) => typeof role === "string" && isSuperAdmin(role));

const requestedRole = (path: string, body: unknown): unknown => {
  const request = asObject(body);
  if (path === "/admin/create-user" || path === "/admin/set-role") {
    return request?.role;
  }
  if (path === "/admin/update-user") return asObject(request?.data)?.role;
  return undefined;
};

const containsPrivilegedRole = (role: unknown): boolean =>
  Array.isArray(role)
    ? role.some((value) =>
        typeof value === "string" ? isPrivilegedRole(value) : false,
      )
    : typeof role === "string" && isPrivilegedRole(role);

/**
 * What an impersonated session may still reach: reads, and the way back out.
 * It acts as its target with the target's MFA state and a fresh `createdAt`, so
 * every other write would be recorded as the impersonated person. Kept as an
 * allowlist so a new Better Auth endpoint is refused until it is judged.
 */
const IMPERSONATION_ADMIN_ROUTES = new Set([
  "/admin/stop-impersonating",
  "/admin/list-users",
  "/admin/get-user",
  "/admin/list-user-sessions",
  "/admin/has-permission",
]);

const IMPERSONATION_ORGANIZATION_ROUTES = new Set([
  "/organization/set-active",
  "/organization/set-active-team",
  "/organization/has-permission",
  "/organization/check-slug",
]);

const isImpersonated = (session: { session?: unknown } | null): boolean =>
  Boolean(asObject(session?.session)?.impersonatedBy);

const refuseImpersonation = (): never => {
  throw new APIError("FORBIDDEN", REFUSALS.impersonated);
};

/**
 * The session the endpoint will act as. Bearer's plugin hook turns the header
 * into a cookie only after these hooks run, so the same swap is made here.
 */
const requestSession = (
  ctx: Parameters<typeof getAuthoritativeSessionFromCtx>[0],
) => {
  if (ctx.context.session) return Promise.resolve(ctx.context.session);
  const header =
    ctx.request?.headers.get("authorization") ??
    ctx.headers?.get("authorization");
  const token = header?.match(/^bearer\s+(\S+)$/i)?.[1];
  if (!token?.includes(".")) return getAuthoritativeSessionFromCtx(ctx);
  const headers = new Headers(ctx.request?.headers ?? ctx.headers);
  setRequestCookie(
    headers,
    ctx.context.authCookies.sessionToken.name,
    token.includes("%") ? decoded(token) : token,
  );
  return getAuthoritativeSessionFromCtx({ ...ctx, headers });
};

const decoded = (value: string): string => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

const refuseExpiredPasswordChange = createAuthMiddleware(async (ctx) => {
  if (ctx.path !== "/change-password") return;
  if (temporaryPasswordExpired((await requestSession(ctx))?.user))
    throw expiredTemporaryPassword();
});

const enforceAdminPolicy = createAuthMiddleware(async (ctx) => {
  if (!ctx.path.startsWith("/admin/")) return;

  const session = await requestSession(ctx);
  if (!session) return;

  if (isImpersonated(session) && !IMPERSONATION_ADMIN_ROUTES.has(ctx.path))
    refuseImpersonation();

  const temporary = temporaryPasswordRefusal(session.user);
  if (temporary) throw new APIError("FORBIDDEN", temporary);

  const actorRole = session.user.role;
  const actorIsSuperAdmin = isSuperAdmin(actorRole);
  if (isPrivilegedRole(actorRole) && !session.user.twoFactorEnabled) {
    throw new APIError("FORBIDDEN", REFUSALS.privilegedTwoFactor);
  }

  if (
    containsPrivilegedRole(requestedRole(ctx.path, ctx.body)) &&
    !actorIsSuperAdmin
  ) {
    throw new APIError("FORBIDDEN", {
      code: "SUPER_ADMIN_REQUIRED",
      message: "Only a super administrator can grant privileged roles.",
    });
  }
  if (
    containsPrivilegedRole(requestedRole(ctx.path, ctx.body)) &&
    !isFresh(session.session.createdAt)
  ) {
    throw new APIError("FORBIDDEN", {
      code: REFUSAL_CODES.sessionNotFresh,
      message: "Sign in again before granting privileged access.",
    });
  }

  if (
    [
      "/admin/set-user-password",
      "/admin/impersonate-user",
      "/admin/remove-user",
    ].includes(ctx.path) &&
    !isFresh(session.session.createdAt)
  ) {
    throw new APIError("FORBIDDEN", {
      code: REFUSAL_CODES.sessionNotFresh,
      message:
        "Sign in again before recovering, impersonating, or deleting an account.",
    });
  }

  if (!TARGETED_ADMIN_ROUTES.has(ctx.path)) return;
  const userId = asObject(ctx.body)?.userId;
  if (typeof userId !== "string") return;
  const target = await ctx.context.internalAdapter.findUserById(userId);
  if (!target) return;
  const targetRole = asObject(target)?.role;
  const normalizedTargetRole =
    typeof targetRole === "string" ? targetRole : undefined;

  if (!canManageTarget(actorRole, normalizedTargetRole)) {
    throw new APIError("FORBIDDEN", REFUSALS.privilegedTarget);
  }

  const disablesSuperAdmin =
    isSuperAdmin(normalizedTargetRole) &&
    (ctx.path === "/admin/ban-user" ||
      ctx.path === "/admin/remove-user" ||
      (requestedRole(ctx.path, ctx.body) !== undefined &&
        removesSuperAdminRole(
          normalizedTargetRole,
          requestedRole(ctx.path, ctx.body),
        )));
  if (disablesSuperAdmin) {
    const count = await ctx.context.internalAdapter.countTotalUsers([
      { field: "role", operator: "contains", value: "super-admin" },
      { field: "banned", operator: "eq", value: false },
    ]);
    if (count <= 1) {
      throw new APIError("BAD_REQUEST", {
        code: "LAST_SUPER_ADMIN",
        message: "The last active super administrator cannot be removed.",
      });
    }
  }
});

const PERSONAL_ORGANIZATION_ROUTES = new Set([
  "/organization/set-active",
  "/organization/set-active-team",
  "/organization/has-permission",
  "/organization/check-slug",
  "/organization/leave",
]);

/**
 * The writes a browser may send to Better Auth's organization routes, each one
 * recorded by `adminAuditEvent`. Every other write — invitations, member roles,
 * creating a team — is refused: `apps/admin` creates subsidiaries, teams and
 * members through the audited `auth-management` routes, and nobody is invited.
 * Those routes call Better Auth in-process, without a request, so this check
 * does not reach them.
 */
const DIRECT_ORGANIZATION_WRITES = new Set([
  "/organization/add-member",
  "/organization/add-team-member",
  "/organization/remove-member",
  "/organization/remove-team",
  "/organization/remove-team-member",
  "/organization/update",
  "/organization/update-team",
]);

const enforceOrganizationWrite = createAuthMiddleware(async (ctx) => {
  if (!ctx.path.startsWith("/organization/") || !ctx.request) return;
  const session = await requestSession(ctx);
  const temporary = temporaryPasswordRefusal(session?.user);
  if (temporary) throw new APIError("FORBIDDEN", temporary);
  if (isRead(ctx.request.method)) return;
  if (
    isImpersonated(session) &&
    !IMPERSONATION_ORGANIZATION_ROUTES.has(ctx.path)
  )
    refuseImpersonation();
  if (PERSONAL_ORGANIZATION_ROUTES.has(ctx.path)) return;
  if (!session || !mayRun(session.user.role, "administer")) {
    throw new APIError("FORBIDDEN", {
      code: "IDENTITY_ADMIN_REQUIRED",
      message:
        "Only an identity administrator can change subsidiaries, teams or membership.",
    });
  }
  if (!session.user.twoFactorEnabled) {
    throw new APIError("FORBIDDEN", {
      code: "PRIVILEGED_TWO_FACTOR_REQUIRED",
      message: "Set up two-factor authentication before changing access.",
    });
  }
  if (!DIRECT_ORGANIZATION_WRITES.has(ctx.path)) {
    throw new APIError("FORBIDDEN", {
      code: "ORGANIZATION_WRITE_NOT_AVAILABLE",
      message: "This subsidiary change is not available.",
    });
  }
  if (
    ctx.path === "/organization/add-member" &&
    asObject(ctx.body)?.role !== "member"
  ) {
    throw new APIError("FORBIDDEN", {
      code: "SUBSIDIARY_ROLE_NOT_ASSIGNABLE",
      message: "Group administrators may add standard subsidiary members only.",
    });
  }
});

/**
 * Better Auth's self-service `/update-user` writes any `input: true` field,
 * the admin-set personal address included, so it is held to the display name.
 */
export const validateProfileUpdate = (
  path: string,
  body: unknown,
): UpdateProfileBody | undefined => {
  if (path !== "/update-user") return undefined;
  const result = updateProfileBody.safeParse(body);
  if (result.success) return result.data;
  throw new APIError("BAD_REQUEST", {
    code: "PROFILE_FIELD_NOT_EDITABLE",
    message: result.error.issues[0]!.message,
  });
};

export const validateAdminWrite = createAuthMiddleware(async (ctx) => {
  validateTemporaryPassword(ctx.path, ctx.body);
  validatePersonalEmail(ctx.path, ctx.body);
  validateAdminUserUpdate(ctx.path, ctx.body);
  const profile = validateProfileUpdate(ctx.path, ctx.body);
  await refuseExpiredPasswordChange(ctx);
  await enforceAdminPolicy(ctx);
  await enforceOrganizationWrite(ctx);
  if (profile) return { context: { body: profile } };
});
