import { messageFor } from "@repo/contracts";
import { adminClient, organizationClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

/**
 * Talks to the core service (`servers/core`). It must list this app's origin in TRUSTED_ORIGINS,
 * and the plugin list here mirrors createAuth() on the server.
 */
export const authClient = createAuthClient({
  baseURL: import.meta.env.VITE_AUTH_BASE_URL ?? "http://localhost:8080",
  plugins: [organizationClient(), adminClient()],
});

export const MIN_PASSWORD_LENGTH = 12;

const CANNOT_REACH = "Can't reach the sign-in service. Try again in a moment.";

const originOf = (value: string | undefined): string | undefined => {
  if (!value) return undefined;
  try {
    return new URL(value).origin;
  } catch {
    return undefined;
  }
};

/**
 * The workspace apps this door may hand someone to. They are separate origins
 * from this one, so a same-origin test would reject every real hand-off; an
 * allowlist is what keeps an open redirect out.
 */
function trustedRedirectOrigins(): string[] {
  const configured = import.meta.env.VITE_TRUSTED_REDIRECT_ORIGINS ?? "";
  return [
    window.location.origin,
    originOf(import.meta.env.VITE_POST_SIGNIN_URL),
    ...configured.split(",").map((origin) => originOf(origin.trim())),
  ].filter((origin): origin is string => origin !== undefined);
}

/** Where a signed-in operator is sent. `?redirect=` wins when its origin is trusted. */
export function postSignInTarget(redirect?: string): string {
  const fallback = import.meta.env.VITE_POST_SIGNIN_URL ?? "/";
  if (!redirect) return fallback;
  try {
    const target = new URL(redirect, window.location.origin);
    return trustedRedirectOrigins().includes(target.origin)
      ? target.toString()
      : fallback;
  } catch {
    return fallback;
  }
}

/**
 * One Better Auth call, with both ways it can fail turned into a sentence: it
 * rejects outright when the server is unreachable, and resolves with an `error`
 * when the server has an opinion.
 */
export async function attemptAuth<TData>(
  call: () => Promise<{ data?: TData | null; error?: unknown }>,
  rejection: string,
): Promise<{ data?: TData | null; failure?: string }> {
  let result;
  try {
    result = await call();
  } catch {
    return { failure: CANNOT_REACH };
  }
  return result.error
    ? { failure: messageFor(result.error, rejection) }
    : { data: result.data };
}
