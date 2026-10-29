import { asObject } from "@repo/contracts";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { betterAuth } from "better-auth/minimal";
import { openAPI } from "better-auth/plugins";
import { admin } from "better-auth/plugins/admin";
import {
  adminAc,
  defaultAc,
  defaultStatements,
  userAc,
} from "better-auth/plugins/admin/access";
import { haveIBeenPwned } from "better-auth/plugins/haveibeenpwned";
import { organization } from "better-auth/plugins/organization";

import type { AuthRepository } from "./infrastructure/persistence/auth.persistence.module";

export interface AuthConfig {
  baseURL: string;
  nodeEnv: "development" | "production" | "test";
  secret: string;
  trustedOrigins: string[];
}

const MIN_PASSWORD_LENGTH = 12;
const MAX_PASSWORD_LENGTH = 256;

/** A person may hold up to this many live sessions; the least recently used go. */
const MAX_CONCURRENT_SESSIONS = 3;

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

interface TemporaryPasswordUpdate {
  mustChangePassword: boolean;
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
    return { mustChangePassword: true, userId: user.id };
  }
  if (
    path === "/admin/set-user-password" &&
    response?.status === true &&
    typeof request?.userId === "string"
  ) {
    return {
      mustChangePassword: true,
      userId: request.userId,
    };
  }
  if (path === "/change-password" && typeof user?.id === "string") {
    return { mustChangePassword: false, userId: user.id };
  }
  return undefined;
};

export const applyTemporaryPasswordLifecycle = async (
  path: string,
  body: unknown,
  returned: unknown,
  updateUser: (
    userId: string,
    data: { mustChangePassword: boolean },
  ) => Promise<unknown>,
): Promise<void> => {
  const update = temporaryPasswordUpdate(path, body, returned);
  if (!update) return;

  await updateUser(update.userId, {
    mustChangePassword: update.mustChangePassword,
  });

  const user = asObject(asObject(returned)?.user);
  if (user?.id === update.userId) {
    user.mustChangePassword = update.mustChangePassword;
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
const superAdminAc = defaultAc.newRole({
  session: [...defaultStatements.session],
  user: [...defaultStatements.user],
});

const validateAdminPassword = createAuthMiddleware(async (ctx) => {
  validateTemporaryPassword(ctx.path, ctx.body);
});

/**
 * An admin-created account starts on a password the employee did not choose and
 * that reached them by email, so it is marked as needing replacement. The flag is
 * not client-writable; it is cleared here once Better Auth accepts the change.
 */
const updateTemporaryPasswordState = createAuthMiddleware(async (ctx) => {
  await applyTemporaryPasswordLifecycle(
    ctx.path,
    ctx.body,
    ctx.context.returned,
    (userId, data) => ctx.context.internalAdapter.updateUser(userId, data),
  );
});

export const createAuth = (repository: AuthRepository, config: AuthConfig) =>
  betterAuth({
    advanced: {
      database: { joins: repository.supportsJoins },
      useSecureCookies: config.nodeEnv === "production",
    },
    appName: "Tagaroa",
    baseURL: config.baseURL,
    database: repository.adapter,
    databaseHooks: {
      session: {
        create: {
          // A person may hold three live sessions at once, so signing in on a
          // fourth device ends the one they touched longest ago.
          after: async (session, ctx) => {
            if (!ctx) return;
            const { internalAdapter } = ctx.context;
            const excess = excessSessionTokens(
              await internalAdapter.listSessions(session.userId),
            );
            if (excess.length > 0) await internalAdapter.deleteSessions(excess);
          },
        },
      },
    },
    hooks: {
      after: updateTemporaryPasswordState,
      before: validateAdminPassword,
    },
    emailAndPassword: {
      // Accounts are issued, never registered — in every environment, so that no
      // test or development shortcut depends on a door the product does not have.
      disableSignUp: true,
      enabled: true,
      maxPasswordLength: MAX_PASSWORD_LENGTH,
      minPasswordLength: MIN_PASSWORD_LENGTH,
    },
    plugins: [
      admin({
        adminRoles: ["admin", "super-admin"],
        defaultRole: "user",
        roles: { admin: adminAc, "super-admin": superAdminAc, user: userAc },
      }),
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
      },
    },
    rateLimit: {
      enabled: config.nodeEnv !== "test",
      storage: "database",
    },
    secret: config.secret,
    trustedOrigins: config.trustedOrigins,
  });

export type Auth = ReturnType<typeof createAuth>;
