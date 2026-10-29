import { passkeyClient } from "@better-auth/passkey/client";
import { messageFor } from "@repo/contracts";
import {
  adminClient,
  organizationClient,
  twoFactorClient,
} from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

/**
 * Always this app's origin. Never point the door at :8080 in the browser —
 * Brave/Safari drop cross-origin Set-Cookie, so sign-in looks successful while
 * getSession stays null and the workspace bounces back to the form.
 *
 * Vite (and production reverse proxies) forward `/api/auth` to core.
 * `VITE_AUTH_BASE_URL` is ignored here on purpose; a leftover .env pointing at
 * 8080 was enough to recreate the loop.
 */
function authBaseURL(): string {
  if (typeof window !== "undefined") return window.location.origin;
  return "http://localhost:3001";
}

/**
 * The plugin list mirrors createAuth() on the server. TRUSTED_ORIGINS on core
 * must still list this app's origin.
 */
export const authClient = createAuthClient({
  fetchOptions: { timeout: 20_000 },
  baseURL: authBaseURL(),
  plugins: [
    organizationClient(),
    adminClient(),
    twoFactorClient({
      onTwoFactorRedirect() {
        // The route owns the redirect so the requested destination survives.
      },
    }),
    passkeyClient(),
  ],
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
 *
 * The `code` rides along beside the sentence because a few refusals are not
 * something to print — they are somewhere to send the person instead.
 */
export async function attemptAuth<TData>(
  call: () => Promise<{ data?: TData | null; error?: unknown }>,
  rejection: string,
): Promise<{ code?: string; data?: TData | null; failure?: string }> {
  let result;
  try {
    result = await call();
  } catch {
    return { failure: CANNOT_REACH };
  }
  if (!result.error) return { data: result.data };

  const code = (result.error as { code?: unknown }).code;
  return {
    ...(typeof code === "string" ? { code } : {}),
    failure: messageFor(result.error, rejection),
  };
}
