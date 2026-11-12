import type { ApiDocument } from "@repo/contracts";
import type { QueryClient } from "@tanstack/react-query";
import { queryOptions } from "@tanstack/react-query";
import { redirect } from "@tanstack/react-router";

import { authClient } from "./auth-client";
import { type Domain, domainsForSlugs } from "./domains";
import {
  createSessionQueryOptions,
  isAdmin,
  isAdmitted,
  type SessionState,
} from "./session-state";
import { AUTH_URL, CORE_URL, WORKSPACE_URL } from "./urls";

export const sessionQueryOptions = createSessionQueryOptions(() =>
  authClient.getSession(),
);

export interface DomainMembership {
  teamId: string;
  organizationId: string;
  domainSlug: string;
  administered: boolean;
}

/**
 * Fail closed: memberships the server did not confirm are none, so an error
 * answer shows the workspace with no domains and `admit` sends a domain visit
 * back to it, rather than admitting on a guess. A request that got no answer
 * fails, like the session read.
 */
export async function fetchDomainMemberships(
  request: (url: string, init?: RequestInit) => Promise<Response> = fetch,
): Promise<DomainMembership[]> {
  const response = await request(`${CORE_URL}/api/access-control/domains`, {
    credentials: "include",
  });
  if (!response.ok) return [];
  const body = (await response
    .json()
    .catch(() => null)) as ApiDocument<unknown> | null;
  if (!Array.isArray(body?.data)) return [];
  return body.data.filter(
    (value): value is DomainMembership =>
      typeof value === "object" &&
      value !== null &&
      typeof value.teamId === "string" &&
      typeof value.organizationId === "string" &&
      typeof value.domainSlug === "string" &&
      typeof value.administered === "boolean",
  );
}

export const domainMembershipQueryOptions = queryOptions({
  queryKey: ["domain-memberships"],
  retry: false,
  queryFn: () => fetchDomainMemberships(),
});

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
  memberships: readonly DomainMembership[],
): boolean {
  // The memberships are argued in, so this must not take them as proof of a
  // session: no session, or one still on a temporary password, administers
  // nothing whatever list it arrives with.
  if (!isAdmitted(session)) return false;
  return memberships.some(
    (team) => team.administered && team.domainSlug === slug,
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
