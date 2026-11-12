import {
  createSessionQueryOptions,
  isAdmin,
  type SessionState,
} from "@repo/shell/session-state";

import { authClient } from "./auth-client";

export const sessionQueryOptions = createSessionQueryOptions(() =>
  authClient.getSession(),
);

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
  if (isAdmin(session) && !session.user.twoFactorEnabled)
    return { to: "secure-account" };
  return { to: "workspace" };
}
