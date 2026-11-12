import { isPrivilegedRole } from "@repo/contracts/identity";
import { queryOptions } from "@tanstack/react-query";

/** What `authClient.getSession()` hands back, narrowed to what the shell reads. */
export type SessionState =
  | {
      session?: {
        impersonatedBy?: string | null;
      };
      user?: {
        id?: string;
        name?: string;
        email?: string;
        mustChangePassword?: boolean;
        twoFactorEnabled?: boolean | null;
        /** Group-wide identity role(s) stored by Better Auth's admin plugin. */
        role?: string | null;
      };
    }
  | null
  | undefined;

export async function fetchSession(
  getSession: () => Promise<{ data: unknown }>,
): Promise<SessionState> {
  try {
    const { data } = await getSession();
    return data as SessionState;
  } catch {
    // An unreachable core service is a session we cannot prove, which is the
    // same answer as no session: send them to the door and let it explain.
    return null;
  }
}

/**
 * Fetched once per page load and shared by every route that guards on it, so a
 * visit to two guarded routes is still one request. The door reads through its
 * own client; every other app through the shell's.
 */
export const createSessionQueryOptions = (
  getSession: () => Promise<{ data: unknown }>,
) =>
  queryOptions({
    queryKey: ["session"],
    // The guard blocks the render, so it must not wait out three backoff
    // retries against a server that is plainly down.
    retry: false,
    queryFn: () => fetchSession(getSession),
  });

/**
 * A temporary password is still a session, so the guard cannot pass it: the door
 * routes `mustChangePassword` to the password step itself.
 */
export const isAdmitted = (session: SessionState): boolean =>
  Boolean(
    session?.user &&
    !session.user.mustChangePassword &&
    (!isAdmin(session) || session.user.twoFactorEnabled),
  );

export const isAdmin = (session: SessionState): boolean =>
  isPrivilegedRole(session?.user?.role);

/** The address to show for whoever is signed in. */
export const operatorOf = (session: SessionState): string =>
  session?.user?.email ?? session?.user?.name ?? "";

/** Whether Better Auth issued this session on behalf of a super-admin. */
export const isImpersonating = (session: SessionState): boolean =>
  Boolean(session?.session?.impersonatedBy);
