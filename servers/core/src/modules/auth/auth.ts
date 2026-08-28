import { asObject } from "@repo/narrow";
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

/** A person may hold up to this many sessions at once; the oldest fall away. */
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
 * The k-anonymity range API: only the first five characters of the hash leave
 * this process. A range request that fails lets the password through, matching
 * Better Auth's own plugin — an unreachable third party must not close signin.
 */
const isBreachedPassword = async (password: string): Promise<boolean> => {
  const digest = await crypto.subtle.digest(
    "SHA-1",
    new TextEncoder().encode(password),
  );
  const hash = Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();

  let body: string;
  try {
    const response = await fetch(
      `https://api.pwnedpasswords.com/range/${hash.slice(0, 5)}`,
    );
    if (!response.ok) return false;
    body = await response.text();
  } catch {
    return false;
  }

  const suffix = hash.slice(5);
  return body.split("\n").some((line) => line.trim().split(":")[0] === suffix);
};

/**
 * Better Auth's length rules and its breach check both sit on the sign-up and
 * change-password routes, so a password an admin issues would reach the employee
 * unchecked. ADR-0001 puts that check here instead.
 */
export const validateTemporaryPassword = async (
  path: string,
  body: unknown,
  breached: (password: string) => Promise<boolean>,
): Promise<void> => {
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
  if (await breached(password)) {
    throw new APIError("BAD_REQUEST", {
      code: "PASSWORD_COMPROMISED",
      message: "Password has been compromised in a data breach",
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

/** The sessions past the cap, oldest first, given every session a person holds. */
export const excessSessionTokens = (
  sessions: readonly { createdAt: Date; token: string }[],
  limit: number = MAX_CONCURRENT_SESSIONS,
): string[] =>
  [...sessions]
    .sort(
      (first, second) => second.createdAt.getTime() - first.createdAt.getTime(),
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

const validateAdminPassword = (
  breached: (password: string) => Promise<boolean>,
) =>
  createAuthMiddleware(async (ctx) => {
    await validateTemporaryPassword(ctx.path, ctx.body, breached);
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

export const createAuth = (repository: AuthRepository, config: AuthConfig) => {
  // The breach check calls a third party, which no unit test should reach and no
  // offline development machine can.
  const checksBreaches = config.nodeEnv === "production";
  const breached = checksBreaches ? isBreachedPassword : async () => false;

  return betterAuth({
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
          // A person may hold three sessions at once, so signing in on a fourth
          // device ends the session they touched longest ago.
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
      before: validateAdminPassword(breached),
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
      haveIBeenPwned({ enabled: checksBreaches }),
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
};

export type Auth = ReturnType<typeof createAuth>;
