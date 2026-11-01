import { passkey } from "@better-auth/passkey";
import { asObject } from "@repo/contracts";
import {
  APIError,
  createAuthMiddleware,
  getAuthoritativeSessionFromCtx,
} from "better-auth/api";
import { betterAuth } from "better-auth/minimal";
import { openAPI } from "better-auth/plugins";
import { admin } from "better-auth/plugins/admin";
import {
  defaultAc,
  defaultStatements,
  userAc,
} from "better-auth/plugins/admin/access";
import { bearer } from "better-auth/plugins/bearer";
import { haveIBeenPwned } from "better-auth/plugins/haveibeenpwned";
import { organization } from "better-auth/plugins/organization";
import { twoFactor } from "better-auth/plugins/two-factor";

import {
  ADMIN_ROLE_CATALOG,
  ADMIN_ROLE_IDS,
  canManageTarget,
  isPrivilegedRole,
  isSuperAdmin,
  OWN_OPERATOR_ACCOUNT_REQUIRED,
  rolesOf,
  removesSuperAdminRole,
} from "./access-policy";
import type { AuthRepository } from "./infrastructure/persistence/auth.persistence.module";

export interface AuthConfig {
  baseURL: string;
  nodeEnv: "development" | "production" | "test";
  passkeyOrigins: string | string[];
  passkeyRpId: string;
  recordAudit?: (event: AuthAuditInput) => Promise<void>;
  secret: string;
  trustedOrigins: string[];
  /** Proxy hops skipped, right to left, in `X-Forwarded-For`. */
  trustedProxies?: string[];
}

export interface AuthAuditInput {
  actorId: string | null;
  detail?: string;
  targetUserId?: string;
  type: string;
}

const MIN_PASSWORD_LENGTH = 12;
const MAX_PASSWORD_LENGTH = 256;

/** A person may hold up to this many live sessions; the least recently used go. */
const MAX_CONCURRENT_SESSIONS = 3;
export const TEMPORARY_PASSWORD_LIFETIME_MS = 24 * 60 * 60 * 1_000;

/**
 * The admin routes that hand an employee a temporary password, and the field
 * each one carries it in. Both the validation before the call and the flag set
 * after it read this map, so a new route is added in one place.
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

  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new APIError("BAD_REQUEST", {
      code: "PASSWORD_TOO_SHORT",
      message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters`,
    });
  }
  if (password.length > MAX_PASSWORD_LENGTH) {
    throw new APIError("BAD_REQUEST", {
      code: "PASSWORD_TOO_LONG",
      message: `Password must be at most ${MAX_PASSWORD_LENGTH} characters`,
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

interface TemporaryPasswordUpdate {
  mustChangePassword: boolean;
  temporaryPasswordExpiresAt: Date | null;
  userId: string;
}

const temporaryPasswordUpdate = (
  path: string,
  body: unknown,
  returned: unknown,
): TemporaryPasswordUpdate | undefined => {
  const response = asObject(returned);
  const request = asObject(body);
  const user = asObject(response?.user);

  if (path === "/admin/create-user" && typeof user?.id === "string") {
    return {
      mustChangePassword: true,
      temporaryPasswordExpiresAt: new Date(),
      userId: user.id,
    };
  }
  if (
    path === "/admin/set-user-password" &&
    response?.status === true &&
    typeof request?.userId === "string"
  ) {
    return {
      mustChangePassword: true,
      temporaryPasswordExpiresAt: new Date(),
      userId: request.userId,
    };
  }
  if (path === "/change-password" && typeof user?.id === "string") {
    return {
      mustChangePassword: false,
      temporaryPasswordExpiresAt: null,
      userId: user.id,
    };
  }
  return undefined;
};

type PendingAuditEvent = Omit<AuthAuditInput, "actorId">;

/** Authentication evidence that must outlive the session or factor row. */
export const authenticationAuditEvent = (
  path: string,
  returned: unknown,
  sessionUserId: string | undefined,
): AuthAuditInput | undefined => {
  const response = asObject(returned);
  const returnedUser = asObject(response?.user);
  const actorId =
    sessionUserId ??
    (typeof returnedUser?.id === "string" ? returnedUser.id : undefined);
  if (!actorId) return undefined;

  let type: string | undefined;
  switch (path) {
    case "/sign-in/email":
      if (response?.twoFactorRedirect === true) return undefined;
      type = "user.signed-in";
      break;
    case "/two-factor/verify-totp":
      type = "user.two-factor.verified";
      break;
    case "/two-factor/verify-backup-code":
      type = "user.two-factor.recovery-used";
      break;
    case "/passkey/verify-registration":
      type = "user.passkey.added";
      break;
    case "/passkey/delete-passkey":
      type = "user.passkey.removed";
      break;
    case "/passkey/verify-authentication":
      type = "user.signed-in.passkey";
      break;
    case "/revoke-session":
      type = "user.session.revoked";
      break;
    case "/revoke-sessions":
      type = "user.sessions.revoked";
      break;
    default:
      return undefined;
  }
  return { actorId, targetUserId: actorId, type };
};

/**
 * The successful Better Auth admin calls that change another person's access.
 * Reads are intentionally absent. A deleted person cannot remain a foreign-key
 * target, so that event retains the old user id as detail instead.
 */
export const adminAuditEvent = (
  path: string,
  body: unknown,
  returned: unknown,
): PendingAuditEvent | undefined => {
  const request = asObject(body);
  const responseUser = asObject(asObject(returned)?.user);
  const requestedUserId =
    typeof request?.userId === "string" ? request.userId : undefined;

  switch (path) {
    case "/admin/create-user":
      return typeof responseUser?.id === "string"
        ? {
            detail:
              typeof responseUser.email === "string"
                ? responseUser.email
                : undefined,
            targetUserId: responseUser.id,
            type: "user.created",
          }
        : undefined;
    case "/admin/set-role": {
      const role = Array.isArray(request?.role)
        ? request.role.join(", ")
        : request?.role;
      return requestedUserId
        ? {
            detail: typeof role === "string" ? role : undefined,
            targetUserId: requestedUserId,
            type: "user.role.updated",
          }
        : undefined;
    }
    case "/admin/update-user": {
      const data = asObject(request?.data);
      const fields = data ? Object.keys(data).sort().join(", ") : undefined;
      return requestedUserId
        ? {
            detail: fields || undefined,
            targetUserId: requestedUserId,
            type: "user.updated",
          }
        : undefined;
    }
    // Better Auth's own vocabulary is "ban", and its path and column keep that
    // name. The trail records what the act means here: an account is suspended
    // when someone leaves or is under investigation, and restored when they come
    // back. Rows written before this carry "user.banned" / "user.unbanned" and
    // are still rendered — an audit trail is not rewritten to match new words.
    case "/admin/ban-user":
      return requestedUserId
        ? {
            detail:
              typeof request?.banReason === "string"
                ? request.banReason
                : undefined,
            targetUserId: requestedUserId,
            type: "user.suspended",
          }
        : undefined;
    case "/admin/unban-user":
      return requestedUserId
        ? { targetUserId: requestedUserId, type: "user.restored" }
        : undefined;
    case "/admin/revoke-user-sessions":
      return requestedUserId
        ? {
            targetUserId: requestedUserId,
            type: "user.sessions.revoked",
          }
        : undefined;
    case "/admin/set-user-password":
      return requestedUserId
        ? {
            targetUserId: requestedUserId,
            type: "user.temporary-password.issued",
          }
        : undefined;
    case "/admin/remove-user":
      return requestedUserId
        ? { detail: requestedUserId, type: "user.deleted" }
        : undefined;
    case "/admin/impersonate-user":
      return requestedUserId
        ? { targetUserId: requestedUserId, type: "user.impersonated" }
        : undefined;
    case "/organization/add-member": {
      const organizationId = request?.organizationId;
      const teamId = request?.teamId;
      const detail = [organizationId, teamId]
        .filter((value): value is string => typeof value === "string")
        .join(":");
      return requestedUserId
        ? {
            detail: detail || undefined,
            targetUserId: requestedUserId,
            type: "user.subsidiary.added",
          }
        : undefined;
    }
    case "/organization/add-team-member":
      return requestedUserId
        ? {
            detail:
              typeof request?.teamId === "string" ? request.teamId : undefined,
            targetUserId: requestedUserId,
            type: "user.team.added",
          }
        : undefined;
    case "/organization/remove-member": {
      const removed = asObject(asObject(returned)?.member);
      return typeof removed?.userId === "string"
        ? {
            targetUserId: removed.userId,
            detail:
              typeof removed.organizationId === "string"
                ? removed.organizationId
                : undefined,
            type: "user.subsidiary.removed",
          }
        : undefined;
    }
    case "/organization/remove-team-member":
      return requestedUserId
        ? {
            detail:
              typeof request?.teamId === "string" ? request.teamId : undefined,
            targetUserId: requestedUserId,
            type: "user.team.removed",
          }
        : undefined;
    default:
      return undefined;
  }
};

export const applyTemporaryPasswordLifecycle = async (
  path: string,
  body: unknown,
  returned: unknown,
  updateUser: (
    userId: string,
    data: {
      mustChangePassword: boolean;
      temporaryPasswordExpiresAt: Date | null;
    },
  ) => Promise<unknown>,
  now: Date = new Date(),
): Promise<void> => {
  const update = temporaryPasswordUpdate(path, body, returned);
  if (!update) return;

  const temporaryPasswordExpiresAt = update.mustChangePassword
    ? new Date(now.getTime() + TEMPORARY_PASSWORD_LIFETIME_MS)
    : null;

  await updateUser(update.userId, {
    mustChangePassword: update.mustChangePassword,
    temporaryPasswordExpiresAt,
  });

  const user = asObject(asObject(returned)?.user);
  if (user?.id === update.userId) {
    user.mustChangePassword = update.mustChangePassword;
    user.temporaryPasswordExpiresAt = temporaryPasswordExpiresAt;
  }
};

/**
 * The live sessions past the cap, least recently used first. Expired rows are
 * ignored rather than deleted: they hold no slot, and purging them belongs to
 * Better Auth. `updatedAt` moves as a session is used, so a laptop opened daily
 * outlives an idle one that happened to sign in later.
 */
export const excessSessionTokens = (
  sessions: readonly { expiresAt: Date; token: string; updatedAt: Date }[],
  now: Date = new Date(),
  limit: number = MAX_CONCURRENT_SESSIONS,
): string[] =>
  sessions
    .filter((session) => session.expiresAt > now)
    .sort(
      (first, second) => second.updatedAt.getTime() - first.updatedAt.getTime(),
    )
    .slice(limit)
    .map((session) => session.token);

/**
 * Group-level break-glass. It holds every statement the admin role does plus
 * `impersonate-admins`, which is what lets it restore a locked-out subsidiary
 * admin. See docs/adr/0001-admin-managed-accounts.md.
 */
const roleDefinition = (id: string) =>
  ADMIN_ROLE_CATALOG.find((role) => role.id === id)?.permissions;

const superAdminAc = defaultAc.newRole({
  session: [...defaultStatements.session],
  user: [...defaultStatements.user],
});
const accessReviewerAc = defaultAc.newRole({
  session: [...(roleDefinition("access-reviewer")?.session ?? [])],
  user: [...(roleDefinition("access-reviewer")?.user ?? [])],
});
const helpdeskAc = defaultAc.newRole({
  session: [...(roleDefinition("helpdesk")?.session ?? [])],
  user: [...(roleDefinition("helpdesk")?.user ?? [])],
});
const adminAc = defaultAc.newRole({
  session: [...(roleDefinition("admin")?.session ?? [])],
  user: [...(roleDefinition("admin")?.user ?? [])],
});

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

const sessionIsFresh = (
  session: { session?: { createdAt?: Date | string } },
  now = new Date(),
): boolean => {
  const createdAt = session.session?.createdAt;
  const age =
    createdAt === undefined
      ? Number.NaN
      : now.getTime() - new Date(createdAt).getTime();
  return Number.isFinite(age) && age >= 0 && age < 15 * 60 * 1_000;
};

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
  throw new APIError("FORBIDDEN", {
    code: "IMPERSONATED_SESSION",
    message: OWN_OPERATOR_ACCOUNT_REQUIRED,
  });
};

const enforceAdminPolicy = createAuthMiddleware(async (ctx) => {
  if (!ctx.path.startsWith("/admin/")) return;

  const session =
    ctx.context.session ?? (await getAuthoritativeSessionFromCtx(ctx));
  if (!session) return;

  if (isImpersonated(session) && !IMPERSONATION_ADMIN_ROUTES.has(ctx.path))
    refuseImpersonation();

  if (session.user.mustChangePassword === true) {
    throw new APIError("FORBIDDEN", {
      code: "PASSWORD_CHANGE_REQUIRED",
      message: "Replace the temporary password before using administration.",
    });
  }

  const actorRole = session.user.role;
  const actorIsSuperAdmin = isSuperAdmin(actorRole);
  if (isPrivilegedRole(actorRole) && !session.user.twoFactorEnabled) {
    throw new APIError("FORBIDDEN", {
      code: "PRIVILEGED_TWO_FACTOR_REQUIRED",
      message: "Set up two-factor authentication before using administration.",
    });
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
    !sessionIsFresh(session)
  ) {
    throw new APIError("FORBIDDEN", {
      code: "SESSION_NOT_FRESH",
      message: "Sign in again before granting privileged access.",
    });
  }

  if (
    [
      "/admin/set-user-password",
      "/admin/impersonate-user",
      "/admin/remove-user",
    ].includes(ctx.path) &&
    !sessionIsFresh(session)
  ) {
    throw new APIError("FORBIDDEN", {
      code: "SESSION_NOT_FRESH",
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
    throw new APIError("FORBIDDEN", {
      code: "PRIVILEGED_TARGET_REQUIRES_SUPER_ADMIN",
      message: "Only a super administrator can manage a privileged account.",
    });
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

const enforceOrganizationWrite = createAuthMiddleware(async (ctx) => {
  if (!ctx.path.startsWith("/organization/") || !ctx.request) return;
  const session =
    ctx.context.session ?? (await getAuthoritativeSessionFromCtx(ctx));
  if (session?.user.mustChangePassword === true) {
    throw new APIError("FORBIDDEN", {
      code: "PASSWORD_CHANGE_REQUIRED",
      message:
        "Replace the temporary password before accessing subsidiary data.",
    });
  }
  if (["GET", "HEAD", "OPTIONS"].includes(ctx.request.method)) return;
  if (
    isImpersonated(session) &&
    !IMPERSONATION_ORGANIZATION_ROUTES.has(ctx.path)
  )
    refuseImpersonation();
  if (PERSONAL_ORGANIZATION_ROUTES.has(ctx.path)) return;
  const role = session?.user.role;
  if (!session || (!isSuperAdmin(role) && !rolesOf(role).includes("admin"))) {
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

const validateAdminWrite = createAuthMiddleware(async (ctx) => {
  validateTemporaryPassword(ctx.path, ctx.body);
  validatePersonalEmail(ctx.path, ctx.body);
  await enforceAdminPolicy(ctx);
  await enforceOrganizationWrite(ctx);
});

/**
 * An admin-created account starts on a password the employee did not choose and
 * that reached them by email, so it is marked as needing replacement. The flag is
 * not client-writable; it is cleared here once Better Auth accepts the change.
 */
export const createAuth = (repository: AuthRepository, config: AuthConfig) => {
  const afterAuthWrite = createAuthMiddleware(async (ctx) => {
    await applyTemporaryPasswordLifecycle(
      ctx.path,
      ctx.body,
      ctx.context.returned,
      (userId, data) => ctx.context.internalAdapter.updateUser(userId, data),
    );

    if (ctx.path === "/admin/create-user") {
      const user = asObject(asObject(ctx.context.returned)?.user);
      if (typeof user?.id === "string") {
        await ctx.context.internalAdapter.updateUser(user.id, {
          // Accounts are issued by an authenticated administrator. This is the
          // product's verification ceremony; the inaccessible new workspace
          // mailbox is never used as an onboarding prerequisite.
          emailVerified: true,
        });
        user.emailVerified = true;
      }
    }

    // A session token is a credential. An operator needs a session's id, device
    // and age to review or revoke it, never the secret that signs in as it.
    if (ctx.path === "/admin/list-user-sessions") {
      const sessions = asObject(ctx.context.returned)?.sessions;
      if (Array.isArray(sessions)) {
        for (const session of sessions) delete asObject(session)?.token;
      }
    }

    if (ctx.path === "/sign-in/email") {
      const returned = asObject(ctx.context.returned);
      const user = asObject(returned?.user);
      const session = asObject(returned?.session);
      const expiresAt = user?.temporaryPasswordExpiresAt;
      const expired =
        user?.mustChangePassword === true &&
        expiresAt !== null &&
        expiresAt !== undefined &&
        new Date(String(expiresAt)).getTime() <= Date.now();
      if (expired) {
        if (typeof session?.token === "string") {
          await ctx.context.internalAdapter.deleteSession(session.token);
        }
        throw new APIError("FORBIDDEN", {
          code: "TEMPORARY_PASSWORD_EXPIRED",
          message:
            "That temporary password has expired. Ask an administrator to issue a new one.",
        });
      }
    }

    const event = adminAuditEvent(ctx.path, ctx.body, ctx.context.returned);
    const actorId =
      ctx.context.newSession?.user.id ?? ctx.context.session?.user.id;
    const auditActorId = ctx.context.session?.user.id ?? actorId;
    if (event && auditActorId && config.recordAudit) {
      await config.recordAudit({ ...event, actorId: auditActorId });
    }

    const authenticationEvent = authenticationAuditEvent(
      ctx.path,
      ctx.context.returned,
      actorId,
    );
    if (authenticationEvent && config.recordAudit) {
      await config.recordAudit(authenticationEvent);
    }
  });

  // Deployed (HTTPS), every cookie is host-only on the API host: with no
  // Domain, dev.tagaroa.cc's never leaves it and tagaroa.cc's never reaches dev,
  // Multica or any other host under the zone. The apps call that host directly,
  // same-site, so it is sent to them all. `__Host-` makes the browser refuse a
  // same-named cookie planted with a Domain by a sibling host.
  const hostOnly = config.nodeEnv === "production";

  return betterAuth({
    advanced: {
      ...(hostOnly && {
        cookiePrefix: "__Host-better-auth",
        defaultCookieAttributes: { secure: true },
      }),
      database: {
        generateId: () => crypto.randomUUID(),
        joins: repository.supportsJoins,
      },
      // The rate limiter keys on this IP. Behind Pangolin and Caddy the header
      // holds several hops, which Better Auth only resolves when it knows which
      // of them are ours; without that every client shares one bucket.
      ipAddress: {
        ipAddressHeaders: ["x-forwarded-for"],
        trustedProxies: config.trustedProxies,
      },
      // `__Host-` above replaces Better Auth's own `__Secure-` prefix.
      useSecureCookies: false,
    },
    appName: "Tagaroa",
    baseURL: config.baseURL,
    database: repository.adapter,
    // Revoking one session takes its token, which no operator may hold, and it
    // never checks whose session it is. Core's
    // `POST /auth-management/sessions/:sessionId/revoke` replaces it.
    disabledPaths: ["/admin/revoke-user-session"],
    databaseHooks: {
      session: {
        create: {
          // A person may hold three live sessions at once, so signing in on a
          // fourth device ends the one they touched longest ago.
          after: async (session, ctx) => {
            if (!ctx) return;
            const { internalAdapter } = ctx.context;
            const sessions = await internalAdapter.listSessions(session.userId);
            const excess = excessSessionTokens(sessions);
            if (excess.length > 0) await internalAdapter.deleteSessions(excess);
          },
        },
      },
    },
    hooks: {
      after: afterAuthWrite,
      before: validateAdminWrite,
    },
    emailAndPassword: {
      // Accounts are issued, never registered — in every environment, so that no
      // test or development shortcut depends on a door the product does not have.
      disableSignUp: true,
      enabled: true,
      maxPasswordLength: MAX_PASSWORD_LENGTH,
      minPasswordLength:
        config.nodeEnv === "production" ? MIN_PASSWORD_LENGTH : 8,
    },
    plugins: [
      admin({
        adminRoles: [...ADMIN_ROLE_IDS],
        defaultRole: "user",
        roles: {
          "access-reviewer": accessReviewerAc,
          admin: adminAc,
          helpdesk: helpdeskAc,
          "super-admin": superAdminAc,
          user: userAc,
        },
      }),
      twoFactor({
        accountLockout: {
          durationSeconds: 15 * 60,
          enabled: true,
          maxFailedAttempts: 10,
        },
        backupCodeOptions: { storeBackupCodes: "encrypted" },
        issuer: "Tagaroa",
        trustDeviceMaxAge: 30 * 24 * 60 * 60,
        twoFactorCookieMaxAge: 10 * 60,
      }),
      passkey({
        authenticatorSelection: { userVerification: "required" },
        origin: config.passkeyOrigins,
        rpID: config.passkeyRpId,
        rpName: "Tagaroa",
      }),
      // Lets the door finish onboarding with the signed `set-auth-token` from
      // sign-in when a cross-origin Set-Cookie was dropped (Brave/Safari) and no
      // session cookie is available for change-password. Signed only: a raw
      // session token, as stored, must never authenticate on its own.
      bearer({ requireSignature: true }),
      // Covers /admin/create-user and /admin/set-user-password among its default
      // paths, so an issued password is checked too. It calls a third party,
      // which no test should reach and no offline machine can.
      haveIBeenPwned({ enabled: config.nodeEnv === "production" }),
      openAPI({ disableDefaultReference: config.nodeEnv === "production" }),
      organization({
        allowUserToCreateOrganization: false,
        disableOrganizationDeletion: true,
        teams: { defaultTeam: { enabled: false }, enabled: true },
      }),
    ],
    user: {
      additionalFields: {
        mustChangePassword: {
          defaultValue: false,
          input: false,
          required: false,
          type: "boolean",
        },
        temporaryPasswordExpiresAt: {
          input: false,
          required: false,
          type: "date",
        },
        /**
         * Where onboarding reaches a new hire before they have a workspace
         * mailbox. `input: true` because an admin is exactly who should set it,
         * and `returned: false` so it never rides along in a listing: the one
         * admin acting on one person reads it through `directory`, and every
         * other admin never holds it at all.
         */
        personalEmail: {
          input: true,
          required: false,
          returned: false,
          type: "string",
        },
      },
    },
    rateLimit: {
      enabled: config.nodeEnv !== "test",
      storage: "database",
    },
    // Better Auth and app-owned access checks use the same definition of a
    // recent sign-in for sensitive changes.
    session: { freshAge: 15 * 60 },
    secret: config.secret,
    trustedOrigins: config.trustedOrigins,
  });
};

export type Auth = ReturnType<typeof createAuth>;
