import { ForbiddenException } from "@nestjs/common";
import {
  ACCESS_WINDOWS,
  isPrivilegedRole,
  REFUSAL_CODES,
} from "@repo/contracts/identity";
import type { UserSession } from "@thallesp/nestjs-better-auth";

/**
 * How long sessions, sign-ins and issued passwords last. `createAuth` configures
 * Better Auth from these, the core's own checks read them, and
 * `GET /auth-management/access-policy` shows them to operators.
 */
export const SESSION_POLICY = {
  concurrentSessions: 3,
  factorRecoveryMs: ACCESS_WINDOWS.factorRecoveryMinutes * 60_000,
  freshAuthenticationMs: 15 * 60 * 1_000,
  temporaryPasswordMs: 24 * 60 * 60 * 1_000,
  trustedDeviceDays: 30,
  twoFactorChallengeMinutes: 10,
} as const;

/** The refusals both Better Auth's hooks and Nest's routes answer with. */
export const REFUSALS = {
  impersonated: {
    code: REFUSAL_CODES.impersonated,
    message: "Use your own MFA-protected operator account.",
  },
  privilegedTwoFactor: {
    code: REFUSAL_CODES.privilegedTwoFactor,
    message: "Set up two-factor authentication before using administration.",
  },
  temporaryPassword: {
    code: REFUSAL_CODES.temporaryPassword,
    message: "Replace your temporary password before using the workspace.",
  },
  temporaryPasswordExpired: {
    code: REFUSAL_CODES.temporaryPasswordExpired,
    message:
      "That temporary password has expired. Ask an administrator to issue a new one.",
  },
  privilegedTarget: {
    code: REFUSAL_CODES.privilegedTarget,
    message: "Only a super administrator can manage a privileged account.",
  },
} as const;

/** The person acting through a session, as every policy check reads them. */
export interface Operator {
  id: string;
  role: string | null | undefined;
  twoFactorEnabled: boolean;
  sessionId: string;
  sessionCreatedAt: Date;
  impersonatedBy: string | null;
}

/** Better Auth's session type leaves out the admin and two-factor fields. */
interface AuthSession {
  session: {
    createdAt: Date | string;
    id: string;
    impersonatedBy?: string | null;
  };
  user: { id: string; role?: string | null; twoFactorEnabled?: boolean | null };
}

export const operatorOf = (value: UserSession | AuthSession): Operator => {
  const { session, user } = value as AuthSession;
  return {
    id: user.id,
    impersonatedBy: session.impersonatedBy ?? null,
    role: user.role,
    sessionCreatedAt: new Date(session.createdAt),
    sessionId: session.id,
    twoFactorEnabled: user.twoFactorEnabled === true,
  };
};

/** A sign-in recent enough for a sensitive change. */
export const isFresh = (
  createdAt: Date | string | undefined,
  now = new Date(),
) => {
  const age =
    createdAt === undefined
      ? Number.NaN
      : now.getTime() - new Date(createdAt).getTime();
  return (
    Number.isFinite(age) &&
    age >= 0 &&
    age < SESSION_POLICY.freshAuthenticationMs
  );
};

export const requireFresh = (
  operator: Pick<Operator, "sessionCreatedAt">,
  message: string,
  now = new Date(),
): void => {
  if (!isFresh(operator.sessionCreatedAt, now))
    throw new ForbiddenException({
      code: REFUSAL_CODES.sessionNotFresh,
      message,
    });
};

/**
 * An impersonated session acts as its target, carrying the target's MFA state
 * and a fresh `createdAt`, so it must never stand in for an operator's own act:
 * a grant, a break-glass or an independent review would be recorded as the
 * impersonated person.
 */
export const requireOwnSession = (operator: {
  impersonatedBy?: string | null;
}): void => {
  if (operator.impersonatedBy)
    throw new ForbiddenException(REFUSALS.impersonated);
};

export const temporaryPasswordExpired = (
  user: Record<string, unknown> | undefined,
  now: number = Date.now(),
): boolean => {
  const expiresAt = user?.temporaryPasswordExpiresAt;
  return (
    user?.mustChangePassword === true &&
    (expiresAt instanceof Date || typeof expiresAt === "string") &&
    new Date(expiresAt).getTime() <= now
  );
};

/** Still on an issued password: replace it, or, once expired, ask for another. */
export const temporaryPasswordRefusal = (
  user: Record<string, unknown> | undefined,
) =>
  user?.mustChangePassword !== true
    ? undefined
    : temporaryPasswordExpired(user)
      ? REFUSALS.temporaryPasswordExpired
      : REFUSALS.temporaryPassword;

const READS = new Set(["GET", "HEAD", "OPTIONS"]);

export const isRead = (method = "GET") => READS.has(method);

/**
 * Why a session may not reach a core route, if it may not: still on an issued
 * password, privileged without a second factor, or impersonating and writing.
 * Better Auth's own routes never reach Nest; `auth.ts` checks those.
 */
export const sessionRefusal = (
  session:
    | {
        session?: { impersonatedBy?: string | null };
        user?: Record<string, unknown> & { role?: string | null };
      }
    | null
    | undefined,
  method = "GET",
): (typeof REFUSALS)[keyof typeof REFUSALS] | undefined => {
  const user = session?.user;
  const temporary = temporaryPasswordRefusal(user);
  if (temporary) return temporary;
  if (isPrivilegedRole(user?.role) && user?.twoFactorEnabled !== true)
    return REFUSALS.privilegedTwoFactor;
  if (session?.session?.impersonatedBy && !isRead(method))
    return REFUSALS.impersonated;
  return undefined;
};
