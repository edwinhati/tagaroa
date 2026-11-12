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

/**
 * Fetched once per page load and shared by every route that guards on it, so a
 * visit to two guarded routes is still one request. The door reads through its
 * own client; every other app through the shell's.
 *
 * Only the core service's answer is a session or its absence. A read that got
 * no answer fails: the browser cancels a page's reads as it is left, and taking
 * that for "signed out" sent people to the door instead of where they went.
 */
export const createSessionQueryOptions = (
  getSession: () => Promise<{ data: unknown; error?: unknown }>,
) =>
  queryOptions({
    queryKey: ["session"],
    // The guard blocks the render, so it must not wait out three backoff
    // retries against a server that is plainly down.
    retry: false,
    queryFn: async () => {
      const { data, error } = await getSession();
      if (error) throw new Error("The session could not be read.");
      return data as SessionState;
    },
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
