import type { ApiDocument } from "@repo/contracts";
import type { QueryClient } from "@tanstack/react-query";
import { queryOptions } from "@tanstack/react-query";
import { redirect } from "@tanstack/react-router";

import { authClient } from "./auth-client";
import { type Domain, domainsForSlugs } from "./domains";

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
        twoFactorEnabled?: boolean;
        /** Group-wide identity role(s) stored by Better Auth's admin plugin. */
        role?: string | null;
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
    // An unreachable core service is a session we cannot prove, which is the
    // same answer as no session: send them to the door and let it explain.
    return null;
  }
}

/**
 * Fetched once per page load and shared by every route that guards on it, so a
 * visit to two guarded routes is still one request.
 */
export const sessionQueryOptions = queryOptions({
  queryKey: ["session"],
  // The guard blocks the render, so it must not wait out three backoff retries
  // against a server that is plainly down.
  retry: false,
  queryFn: () => fetchSession(),
});

export interface DomainMembership {
  teamId: string;
  organizationId: string;
  domainSlug: string;
  administered: boolean;
}

export async function fetchDomainMemberships(
  request: (url: string, init?: RequestInit) => Promise<Response> = fetch,
): Promise<DomainMembership[]> {
  try {
    const response = await request(`${CORE_URL}/api/access-control/domains`, {
      credentials: "include",
    });
    if (!response.ok) return [];
    const body = (await response.json()) as ApiDocument<unknown>;
    if (!Array.isArray(body.data)) return [];
    return body.data.filter(
      (value): value is DomainMembership =>
        typeof value === "object" &&
        value !== null &&
        typeof value.teamId === "string" &&
        typeof value.organizationId === "string" &&
        typeof value.domainSlug === "string" &&
        typeof value.administered === "boolean",
    );
  } catch {
    return [];
  }
}

export const domainMembershipQueryOptions = queryOptions({
  queryKey: ["domain-memberships"],
  retry: false,
  queryFn: () => fetchDomainMemberships(),
});

export const AUTH_URL =
  import.meta.env.VITE_AUTH_URL ?? "http://localhost:3001";

/**
 * The other origins in the workspace. Only the domain front ends live behind the
 * microfrontends proxy; `apps/admin` stands on its own, so a link to it is a
 * document navigation to another origin rather than a path on this one.
 */
export const WORKSPACE_URL =
  import.meta.env.VITE_WORKSPACE_URL ?? "http://localhost:3000";
export const ADMIN_URL =
  import.meta.env.VITE_ADMIN_URL ?? "http://localhost:3003";

const CORE_URL = import.meta.env.VITE_AUTH_BASE_URL ?? "http://localhost:8080";

/**
 * The door, carrying the way back. `apps/auth` only honours a `?redirect=` whose
 * origin it trusts (VITE_TRUSTED_REDIRECT_ORIGINS), so this app's origin must be
 * listed there or the operator lands on the door's own default.
 */
export function signInUrl(current: string, authUrl: string = AUTH_URL): string {
  const door = new URL(authUrl);
  door.searchParams.set("redirect", current);
  return door.toString();
}

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

/** Server decisions for current memberships; identity roles do not imply business access. */
export async function fetchAdministeredDomains(): Promise<string[]> {
  return (await fetchDomainMemberships())
    .filter((team) => team.administered)
    .map((team) => team.domainSlug);
}

export const administeredDomainsQueryOptions = queryOptions({
  queryKey: ["administered-domains"],
  retry: false,
  queryFn: () => fetchAdministeredDomains(),
});

/**
 * May this person administer this domain's configuration?
 *
 * Identity roles do not silently become business access. A super-admin must
 * activate scoped emergency access before the server includes a domain.
 *
 * This decides what to *show*. Enforcement is the core service refusing the
 * write, the same as everywhere else in this system.
 */
export function isDomainAdmin(
  session: SessionState,
  slug: string,
  administeredDomains: readonly string[] = [],
): boolean {
  // The adminships are argued in, so this must not take them as proof of a
  // session: no session, or one still on a temporary password, administers
  // nothing whatever list it arrives with.
  if (!isAdmitted(session)) return false;
  return domainsForSlugs(administeredDomains).some(
    (domain) => domain.slug === slug,
  );
}

/**
 * Admission, identical in the shell and in every domain app: resolve the session
 * or leave for the door. `href` rather than `to`, because the door is its own
 * origin and this has to be a document navigation.
 *
 * Call it from a route with `ssr: false` — the session is a cookie for the core
 * service, an origin these apps' servers never see.
 */
export async function admit(
  queryClient: QueryClient,
  domainSlug?: string,
): Promise<{ session: SessionState; domains: Domain[]; admin: boolean }> {
  const [session, memberships] = await Promise.all([
    queryClient.ensureQueryData(sessionQueryOptions),
    queryClient.ensureQueryData(domainMembershipQueryOptions),
  ]);
  if (!isAdmitted(session)) {
    throw redirect({ href: signInUrl(window.location.href) });
  }
  const domains = domainsForSlugs(memberships.map((team) => team.domainSlug));
  if (domainSlug && !domains.some((domain) => domain.slug === domainSlug)) {
    throw redirect({ href: WORKSPACE_URL });
  }
  return { session, domains, admin: isAdmin(session) };
}

/**
 * Mirrors `adminRoles` in servers/core's createAuth(). Kept as a list because
 * better-auth stores the role as a comma-separated string when a person holds
 * more than one.
 */
const ADMIN_ROLES = new Set([
  "access-reviewer",
  "helpdesk",
  "admin",
  "super-admin",
]);

export const isAdmin = (session: SessionState): boolean =>
  (session?.user?.role ?? "")
    .split(",")
    .some((role) => ADMIN_ROLES.has(role.trim()));

/**
 * Admission to the admin surface. Two different refusals, deliberately: no
 * session at all is a trip to the door, but a valid session without the role is
 * sent back to the workspace — telling a signed-in operator to sign in again
 * would be a lie about what is wrong.
 *
 * This hides; it does not gate. Enforcement is the core service refusing the
 * admin endpoints, which `adminRoles` already does.
 */
export async function admitAdmin(
  queryClient: QueryClient,
): Promise<SessionState> {
  const session = await queryClient.ensureQueryData(sessionQueryOptions);
  if (!isAdmitted(session)) {
    throw redirect({ href: signInUrl(window.location.href) });
  }
  if (!isAdmin(session)) {
    // The workspace's origin, not this one: a bare "/" would land them back on
    // the surface that just refused them.
    throw redirect({ href: WORKSPACE_URL });
  }
  return session;
}

/** The address to show for whoever is signed in. */
export const operatorOf = (session: SessionState): string =>
  session?.user?.email ?? session?.user?.name ?? "";

/** Whether Better Auth issued this session on behalf of a super-admin. */
export const isImpersonating = (session: SessionState): boolean =>
  Boolean(session?.session?.impersonatedBy);
