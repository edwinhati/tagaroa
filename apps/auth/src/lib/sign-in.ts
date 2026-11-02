import type { attemptAuth } from "./auth-client";

type Attempt = Awaited<ReturnType<typeof attemptAuth<unknown>>>;

/**
 * What an email-and-password attempt means for the door. Their credentials
 * being right while the door stays shut (suspended, expired temporary password)
 * is a different conversation from a wrong password, so those leave the form.
 */
export type SignInOutcome =
  | { kind: "locked-out"; reason: "suspended" | "expired" }
  | { kind: "failure"; failure: string }
  | { kind: "two-factor" }
  | { kind: "choose-password"; token: string }
  | { kind: "signed-in"; token: string };

export function signInOutcome({ code, data, failure }: Attempt): SignInOutcome {
  // Better Auth's own words for these mention a support desk this company
  // does not have.
  if (code === "BANNED_USER")
    return { kind: "locked-out", reason: "suspended" };
  if (code === "TEMPORARY_PASSWORD_EXPIRED")
    return { kind: "locked-out", reason: "expired" };
  if (failure) return { kind: "failure", failure };

  const body = (data ?? {}) as {
    token?: unknown;
    twoFactorRedirect?: boolean;
    user?: { mustChangePassword?: boolean };
  };
  if (body.twoFactorRedirect) return { kind: "two-factor" };

  const token = typeof body.token === "string" ? body.token : "";
  return body.user?.mustChangePassword
    ? { kind: "choose-password", token }
    : { kind: "signed-in", token };
}

/** A spent 2FA challenge cannot be retried with another code, only restarted. */
export function twoFactorFailure({ code, failure }: Attempt) {
  if (!failure) return null;
  return code === "INVALID_TWO_FACTOR_COOKIE" ||
    code === "TOO_MANY_ATTEMPTS_REQUEST_NEW_CODE"
    ? "This verification is no longer valid. Sign in again."
    : failure;
}
