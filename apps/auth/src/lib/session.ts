import { queryOptions } from "@tanstack/react-query";

import { authClient } from "./auth-client";

/** What `authClient.getSession()` hands back, narrowed to the part routes read. */
export type SessionState =
  | {
      user?: {
        email?: string;
        id?: string;
        mustChangePassword?: boolean;
        role?: string | null;
        twoFactorEnabled?: boolean | null;
      };
    }
  | null
  | undefined;

export async function fetchSession(
  getSession: () => Promise<{ data: unknown }> = () => authClient.getSession(),
): Promise<SessionState> {
  try {
    const { data } = await getSession();
    return data as SessionState;
  } catch {
    // An unreachable auth server is still a session we cannot prove, so the
    // sign-in form remains available instead of becoming an error page.
    return null;
  }
}

/**
 * Fetched once per page load and shared by every route that guards on it, so a
 * visit to two guarded routes is still one request.
 */
export const sessionQueryOptions = queryOptions({
  queryKey: ["session"],
  // A guard blocks the render, so it must not wait out three backoff retries
  // against a server that is plainly down.
  retry: false,
  queryFn: () => fetchSession(),
});

/** Which step the sign-in page opens on, or the workspace it hands off to. */
export type Destination =
  | { to: "form" }
  | { to: "choose-password" }
  | { to: "secure-account" }
  | { to: "workspace" };

/** Nobody signs in twice: an existing session skips the form. */
export function signInDestination(session: SessionState): Destination {
  if (!session?.user) return { to: "form" };
  if (session.user.mustChangePassword) return { to: "choose-password" };
  const privileged = (session.user.role ?? "")
    .split(",")
    .some((role) =>
      ["access-reviewer", "helpdesk", "admin", "super-admin"].includes(
        role.trim(),
      ),
    );
  if (privileged && !session.user.twoFactorEnabled) {
    return { to: "secure-account" };
  }
  return { to: "workspace" };
}
