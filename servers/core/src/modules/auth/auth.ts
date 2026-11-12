import { passkey } from "@better-auth/passkey";
import { asObject } from "@repo/contracts";
import {
  ADMIN_ROLE_IDS,
  IDENTITY_ROLES,
  PASSWORD_LENGTH,
} from "@repo/contracts/identity";
import { createAuthMiddleware } from "better-auth/api";
import { deleteSessionCookie } from "better-auth/cookies";
import { betterAuth } from "better-auth/minimal";
import { openAPI } from "better-auth/plugins";
import { admin } from "better-auth/plugins/admin";
import { defaultAc } from "better-auth/plugins/admin/access";
import { bearer } from "better-auth/plugins/bearer";
import { haveIBeenPwned } from "better-auth/plugins/haveibeenpwned";
import { organization } from "better-auth/plugins/organization";
import { twoFactor } from "better-auth/plugins/two-factor";

import {
  adminAuditEvent,
  type AuthAuditInput,
  authenticationAuditEvent,
  endedSessionAuditEvent,
} from "./audit-events";
import type { AuthRepository } from "./infrastructure/persistence/auth.persistence.module";
import { expiredTemporaryPassword, validateAdminWrite } from "./request-policy";
import { SESSION_POLICY, temporaryPasswordExpired } from "./session-policy";

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
    ? new Date(now.getTime() + SESSION_POLICY.temporaryPasswordMs)
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
  sessions: readonly {
    expiresAt: Date;
    impersonatedBy?: string | null;
    token: string;
    updatedAt: Date;
  }[],
  now: Date = new Date(),
  limit: number = SESSION_POLICY.concurrentSessions,
): string[] =>
  sessions
    // An operator's impersonation holds none of the person's own slots.
    .filter((session) => session.expiresAt > now && !session.impersonatedBy)
    .sort(
      (first, second) => second.updatedAt.getTime() - first.updatedAt.getTime(),
    )
    .slice(limit)
    .map((session) => session.token);

const accessControlRoles = Object.fromEntries(
  IDENTITY_ROLES.map(({ id, permissions }) => [
    id,
    defaultAc.newRole({
      session: [...permissions.session],
      user: [...permissions.user],
    }),
  ]),
);

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

    const signedIn = ctx.context.newSession;
    if (
      ctx.path === "/sign-in/email" &&
      signedIn &&
      temporaryPasswordExpired(signedIn.user)
    ) {
      await ctx.context.internalAdapter.deleteSession(signedIn.session.token);
      deleteSessionCookie(ctx);
      // Hooks after this one still run; two-factor's would answer the sign-in.
      ctx.context.setNewSession(null);
      throw expiredTemporaryPassword();
    }

    // A reissue means a lockout or a compromise, so no old session survives it.
    if (
      ctx.path === "/admin/set-user-password" &&
      asObject(ctx.context.returned)?.status === true
    ) {
      const userId = asObject(ctx.body)?.userId;
      if (typeof userId === "string")
        await ctx.context.internalAdapter.deleteUserSessions(userId);
    }

    // A failed call is answered with its error, and the after hook still runs.
    // Nothing happened, so nothing is recorded.
    if (ctx.context.returned instanceof Error) return;

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
            if (!ctx || session.impersonatedBy) return;
            const { internalAdapter } = ctx.context;
            const sessions = await internalAdapter.listSessions(session.userId);
            const excess = excessSessionTokens(sessions);
            if (excess.length > 0) await internalAdapter.deleteSessions(excess);
          },
        },
        delete: {
          after: async (session, ctx) => {
            const event = endedSessionAuditEvent(ctx?.path, session);
            if (event && config.recordAudit) await config.recordAudit(event);
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
      maxPasswordLength: PASSWORD_LENGTH.max,
      minPasswordLength: PASSWORD_LENGTH.min,
    },
    plugins: [
      admin({
        adminRoles: [...ADMIN_ROLE_IDS],
        defaultRole: "user",
        roles: accessControlRoles,
      }),
      twoFactor({
        accountLockout: {
          durationSeconds: 15 * 60,
          enabled: true,
          maxFailedAttempts: 10,
        },
        backupCodeOptions: { storeBackupCodes: "encrypted" },
        issuer: "Tagaroa",
        trustDeviceMaxAge: SESSION_POLICY.trustedDeviceDays * 24 * 60 * 60,
        twoFactorCookieMaxAge: SESSION_POLICY.twoFactorChallengeMinutes * 60,
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
    session: { freshAge: SESSION_POLICY.freshAuthenticationMs / 1_000 },
    secret: config.secret,
    trustedOrigins: config.trustedOrigins,
  });
};

export type Auth = ReturnType<typeof createAuth>;
