import { createWorkspaceAuthClient } from "@repo/shell/create-auth-client";
import {
  ADMIN_URL,
  CORE_URL,
  IS_DEPLOYED,
  WORKSPACE_URL,
} from "@repo/shell/urls";

/**
 * Deployed, the door calls core on the API host like every other app, so the
 * session cookie is host-only there (`dev.tagaroa.cc`) and no other host under
 * the zone ever receives it.
 *
 * In local dev it stays on this app's origin and Vite forwards `/api/auth` to
 * core: Brave/Safari dropped the Set-Cookie from `localhost:8080`, so sign-in
 * looked successful while getSession stayed null. Cookies ignore ports, so the
 * `localhost` cookie still reaches core for the other apps. A leftover .env
 * pointing at 8080 was enough to recreate that loop, hence DEV ignores it.
 */
function authBaseURL(): string {
  if (
    !import.meta.env.DEV &&
    (import.meta.env.VITE_AUTH_BASE_URL || IS_DEPLOYED)
  ) {
    return CORE_URL;
  }
  if (typeof window !== "undefined") return window.location.origin;
  return "http://localhost:3001";
}

/** TRUSTED_ORIGINS on core must list this app's origin. */
export const authClient = createWorkspaceAuthClient(authBaseURL());

const originOf = (value: string | undefined): string | undefined => {
  if (!value) return undefined;
  try {
    return new URL(value).origin;
  } catch {
    return undefined;
  }
};

/** Deployed, the workspace; locally, whatever .env names. */
const postSignInURL = (): string | undefined =>
  import.meta.env.VITE_POST_SIGNIN_URL ??
  (IS_DEPLOYED ? WORKSPACE_URL : undefined);

/**
 * The workspace apps this door may hand someone to. They are separate origins
 * from this one, so a same-origin test would reject every real hand-off; an
 * allowlist is what keeps an open redirect out.
 */
function trustedRedirectOrigins(): string[] {
  const configured =
    import.meta.env.VITE_TRUSTED_REDIRECT_ORIGINS ??
    (IS_DEPLOYED ? `${WORKSPACE_URL},${ADMIN_URL}` : "");
  return [
    window.location.origin,
    originOf(postSignInURL()),
    ...configured.split(",").map((origin) => originOf(origin.trim())),
  ].filter((origin): origin is string => origin !== undefined);
}

/** Where a signed-in operator is sent. `?redirect=` wins when its origin is trusted. */
export function postSignInTarget(redirect?: string): string {
  const fallback = postSignInURL() ?? "/";
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
