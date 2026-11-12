import {
  type ApiDocument,
  asObject,
  type Collection,
  messageFor,
} from "@repo/contracts";
import {
  ADMIN_ROLE_IDS,
  IDENTITY_ROLE_IDS,
  REFUSAL_CODES,
} from "@repo/contracts/identity";
import { authClient } from "@repo/shell/auth-client";
import { AUTH_URL, CORE_URL } from "@repo/shell/urls";
import { toast } from "@repo/ui/components/toast";
import {
  keepPreviousData,
  type QueryClient,
  queryOptions,
} from "@tanstack/react-query";

/**
 * Account operations use Better Auth's `admin` and `organization` clients.
 * Group-wide policy and operations that Better Auth deliberately scopes to an
 * active organization use the core service's narrow management endpoints.
 * The shapes below are what the tables render, not the full rows.
 */

export interface Person {
  id: string;
  email: string;
  emailVerified: boolean;
  name: string;
  role: string | null;
  banned: boolean | null;
  banExpires?: string | Date | null;
  banReason?: string | null;
  mustChangePassword?: boolean;
  temporaryPasswordExpiresAt?: string | Date | null;
  twoFactorEnabled?: boolean;
  createdAt: string | Date;
}

export interface PersonSession {
  id: string;
  createdAt: string | Date;
  updatedAt: string | Date;
  expiresAt: string | Date;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export interface LinkedAccount {
  accountId: string;
  createdAt: string | Date;
  id: string;
  providerId: string;
}

export interface AuthEvent {
  actor: string;
  at: string | Date;
  detail?: string | null;
  id: string;
  target?: string | null;
  type: string;
}

export type AttentionKind =
  | "temporary-password"
  | "unverified-email"
  | "no-subsidiary";

export type VisibleAttentionKind = Exclude<AttentionKind, "temporary-password">;

export interface IdentityIssue {
  ageDays: number;
  email: string;
  kind: AttentionKind;
  name: string;
  userId: string;
}

export interface PersonHealth {
  activeSessions: number;
  attention: AttentionKind[];
  lastActiveAt: string | Date | null;
  userId: string;
}

export interface PrivilegedAccessReview {
  email: string;
  name: string;
  reviewed: boolean;
  reviewedAt: string | Date | null;
  role: string;
  userId: string;
}

export interface DashboardData {
  accessReview: {
    people: PrivilegedAccessReview[];
    reviewed: number;
    total: number;
    weekStartedAt: string | Date;
  };
  attention: IdentityIssue[];
  counts: {
    linkedAccounts: number;
    organizations: number;
    users: number;
  };
  events: AuthEvent[];
  people: PersonHealth[];
}

type DashboardDocument = Omit<
  DashboardData,
  "accessReview" | "attention" | "events" | "people"
> & {
  accessReview: Omit<DashboardData["accessReview"], "people"> & {
    people: Collection<PrivilegedAccessReview>;
  };
  attention: Collection<IdentityIssue>;
  events: Collection<AuthEvent>;
  people: Collection<PersonHealth>;
};

export interface Subsidiary {
  id: string;
  memberIds: string[];
  name: string;
  slug: string;
}

export interface Team {
  id: string;
  name: string;
  organizationId: string;
}

/**
 * better-auth resolves with `{ data, error }` rather than rejecting, so a failed
 * write looks exactly like a successful one to react-query. Every mutation on
 * this surface goes through here, or it will report success it did not have.
 */
export async function write<T>(
  call: () => Promise<{
    data?: T;
    error?: { code?: string; message?: string; status?: number } | null;
  }>,
  failure: string,
): Promise<T | undefined> {
  const { data, error } = await call();
  if (error)
    throw new AdminApiError(
      error.message || failure,
      error.code,
      error.status ?? 0,
    );
  return data;
}

/** What the core service says became of a message it was asked to send. */
export interface OnboardingOutcome {
  queued: boolean;
  destination: string | null;
  reason?: string;
}

/**
 * The outcome the core service rides back on `create-user` and
 * `set-user-password`.
 *
 * Read defensively rather than typed: Better Auth's generated client knows
 * nothing about this field, and a service that says nothing has promised
 * nothing — which is the honest thing to show.
 */
export function onboardingOutcome(result: unknown): OnboardingOutcome | null {
  if (typeof result !== "object" || result === null) return null;
  const value = (result as { onboarding?: unknown }).onboarding;
  if (typeof value !== "object" || value === null) return null;

  const { destination, queued, reason } = value as Record<string, unknown>;
  if (typeof queued !== "boolean") return null;

  return {
    destination: typeof destination === "string" ? destination : null,
    queued,
    ...(typeof reason === "string" ? { reason } : {}),
  };
}

/**
 * Team writes are resolved against the session's active organization, not the
 * team's own — an admin who has not "entered" a subsidiary gets
 * NO_ACTIVE_ORGANIZATION. Setting it first makes the call mean what it reads
 * like.
 */
export async function inSubsidiary<T>(
  organizationId: string,
  call: () => Promise<{ data?: T; error?: { message?: string } | null }>,
  failure: string,
): Promise<T | undefined> {
  await write(
    () => authClient.organization.setActive({ organizationId }),
    "Could not switch to that subsidiary.",
  );
  return write(call, failure);
}

/**
 * better-auth answers `{ data, error }`. A read that fails must reject rather
 * than resolve empty: an unreachable core service and a group with nobody in it
 * are different facts, and a page that renders the second for the first is lying
 * about the state of the company.
 */
async function read<T>(
  call: () => Promise<{ data?: unknown; error?: { message?: string } | null }>,
  pick: (data: unknown) => T,
  failure: string,
): Promise<T> {
  const { data, error } = await call();
  if (error) throw new Error(error.message || failure);
  return pick(data ?? null);
}

const rows = <T>(data: unknown, key?: string): T[] => {
  const value =
    key && data && typeof data === "object"
      ? (data as Record<string, unknown>)[key]
      : data;
  return Array.isArray(value) ? (value as T[]) : [];
};

/**
 * Everybody, for the surfaces that genuinely need everybody.
 *
 * Subsidiaries is the one: its rosters are "who is in this team" and "who could
 * be added", and neither question has an answer inside a page of results. The
 * People table does not use this — it asks for one page at a time.
 */
async function readEveryPerson(): Promise<Person[]> {
  const limit = 100;
  const people: Person[] = [];
  let offset = 0;

  while (true) {
    const page = await read<{ total: number; users: Person[] }>(
      () => authClient.admin.listUsers({ query: { limit, offset } }),
      (data) => {
        const document =
          data && typeof data === "object"
            ? (data as Record<string, unknown>)
            : {};
        return {
          total: typeof document.total === "number" ? document.total : Infinity,
          users: rows<Person>(data, "users"),
        };
      },
      "Could not read the group's accounts.",
    );
    people.push(...page.users);
    if (page.users.length < limit || people.length >= page.total) return people;
    offset += page.users.length;
  }
}

export const everyPersonQueryOptions = queryOptions({
  queryKey: ["admin", "people", "all"],
  queryFn: readEveryPerson,
});

/** Which accounts the People page is looking at. */
export type PeopleSlice = "all" | "admins" | "suspended";

export interface PeopleQuery {
  page: number;
  pageSize: number;
  role: string | null;
  search: string;
  slice: PeopleSlice;
  sort: { direction: "asc" | "desc"; field: string };
}

/** Shareable state for the People directory and a person's return link. */
export interface PeopleSearch {
  page?: number;
  q?: string;
  role?: string;
  size?: number;
  slice?: PeopleSlice;
  sort?: string;
}

/** The page sizes every table offers; the core service's default is 25. */
export const PAGE_SIZES = [10, 25, 50, 100];
export const DEFAULT_PAGE_SIZE = 25;
const PEOPLE_SORTS = new Set(["account", "-account", "access", "-access"]);

export function validatePeopleSearch(
  search: Record<string, unknown>,
): PeopleSearch {
  const result: PeopleSearch = {};
  if (search.slice === "admins" || search.slice === "suspended") {
    result.slice = search.slice;
  }
  if (typeof search.q === "string" && search.q.trim()) {
    result.q = search.q.trim().slice(0, 160);
  }
  if (typeof search.sort === "string" && PEOPLE_SORTS.has(search.sort)) {
    result.sort = search.sort;
  }
  const role = Array.isArray(search.role) ? search.role[0] : search.role;
  if (
    typeof role === "string" &&
    IDENTITY_ROLE_IDS.includes(role as (typeof IDENTITY_ROLE_IDS)[number])
  ) {
    result.role = role;
  }
  const page = Number(search.page);
  if (Number.isInteger(page) && page > 1) result.page = page;
  const size = Number(search.size);
  if (PAGE_SIZES.includes(size)) result.size = size;
  return result;
}

export interface PeoplePage {
  people: Person[];
  total: number;
}

/**
 * One page of accounts, as Better Auth's `listUsers` wants it asked for.
 *
 * Two constraints shape everything here, and both are the plugin's, not ours.
 * `listUsers` takes exactly one `searchField` and exactly one `filterField` per
 * request. So the search box picks a column instead of spanning two, and the
 * standing of an account is chosen as a slice — navigation — rather than as a
 * facet standing beside Role, because there is only ever one filter to give.
 */
export function listUsersQuery(query: PeopleQuery): Record<string, unknown> {
  const params: Record<string, unknown> = {
    limit: query.pageSize,
    offset: (query.page - 1) * query.pageSize,
    sortBy: query.sort.field,
    sortDirection: query.sort.direction,
  };

  // An address is the only thing anyone types with an "@" in it, so it is what
  // decides which column to look in. Someone whose name contains one is missed.
  const search = query.search.trim();
  if (search) {
    params.searchField = search.includes("@") ? "email" : "name";
    params.searchOperator = "contains";
    params.searchValue = search;
  }

  if (query.slice === "suspended") {
    // Only ever `true`: an account that has never been suspended has NULL here,
    // not false, so filtering for `false` would hide almost everybody. "Active"
    // is the unfiltered list, which is also what it means.
    params.filterField = "banned";
    params.filterOperator = "eq";
    params.filterValue = true;
  } else if (query.slice === "admins") {
    params.filterField = "role";
    params.filterOperator = "in";
    params.filterValue = ADMIN_ROLE_IDS;
  } else if (query.role) {
    params.filterField = "role";
    params.filterOperator = "eq";
    params.filterValue = query.role;
  }

  return params;
}

/**
 * ponytail: matches `role` exactly, so someone holding two roles at once
 * ("admin,super-admin") is missed by the Role facet and the Admins slice. Nobody
 * is issued two today. If that changes, the filter has to become `contains` with
 * the comma-boundary problem handled, or the list has to move to a core endpoint
 * that can read the column properly.
 */
export const peopleQueryOptions = (query: PeopleQuery) =>
  queryOptions({
    queryKey: ["admin", "people", "page", query],
    placeholderData: keepPreviousData,
    queryFn: () =>
      read<PeoplePage>(
        () => authClient.admin.listUsers({ query: listUsersQuery(query) }),
        (data) => ({
          people: rows<Person>(data, "users"),
          total:
            typeof (data as Record<string, unknown> | null)?.total === "number"
              ? ((data as Record<string, number>).total as number)
              : rows<Person>(data, "users").length,
        }),
        "Could not read the group's accounts.",
      ),
  });

/** One account for the route-backed person workspace. */
export const personQueryOptions = (userId: string) =>
  queryOptions({
    queryKey: ["admin", "people", userId],
    queryFn: () =>
      read<Person>(
        () => authClient.admin.getUser({ query: { id: userId } }),
        (data) => data as Person,
        "Could not read this account.",
      ),
  });

export const personSessionsQueryOptions = (userId: string) =>
  queryOptions({
    queryKey: ["admin", "people", userId, "sessions"],
    queryFn: () =>
      read<PersonSession[]>(
        () => authClient.admin.listUserSessions({ userId }),
        (data) => rows<PersonSession>(data, "sessions"),
        "Could not read this person's sessions.",
      ),
  });

/**
 * The whole group in one read, from `servers/core`'s /directory.
 *
 * Better Auth's own endpoints cannot answer this: `/organization/list` is scoped
 * to the caller's memberships and `/organization/list-team-members` refuses a
 * caller who is not in the team. An admin oversees teams they are not in, so the
 * core service reads the tables instead — behind the same role. Writes still go
 * through Better Auth.
 */
export interface Directory {
  positions: Position[];
  subsidiaries: Subsidiary[];
  teams: (Team & { memberIds: string[] })[];
}

export interface Position {
  id: string;
  managerUserId: string | null;
  organizationId: string | null;
  title: string;
  updatedAt: string | Date;
  updatedBy: string | null;
  userId: string;
}

export class AdminApiError extends Error {
  constructor(
    message: string,
    readonly code: string | undefined,
    readonly status: number,
  ) {
    super(message);
    this.name = "AdminApiError";
  }
}

type Method = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

/**
 * One request to the core service. A refusal is an `AdminApiError` carrying
 * the server's code and status: a write says what the server said, a read says
 * what could not be loaded.
 */
async function core<T>(
  path: string,
  {
    body,
    failure,
    method = "GET",
    signal,
  }: { body?: unknown; failure: string; method?: Method; signal?: AbortSignal },
): Promise<T> {
  const response = await fetch(`${CORE_URL}${path}`, {
    ...(body === undefined
      ? {}
      : {
          body: JSON.stringify(body),
          headers: { "content-type": "application/json" },
        }),
    credentials: "include",
    method,
    signal,
  });
  const said: unknown =
    response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) {
    const code = asObject(said)?.code;
    throw new AdminApiError(
      method === "GET" ? failure : messageFor(said, failure),
      typeof code === "string" ? code : undefined,
      response.status,
    );
  }
  return said as T;
}

export async function coreReadDocument<T>(
  path: string,
  failure: string,
  signal?: AbortSignal,
): Promise<T> {
  return (await core<ApiDocument<T>>(path, { failure, signal })).data;
}

export async function coreMutationDocument<T>(
  path: string,
  method: Exclude<Method, "GET">,
  body: object | undefined,
  failure: string,
): Promise<T> {
  return (await core<ApiDocument<T> | null>(path, { body, failure, method }))
    ?.data as T;
}

/** One session, by id: core checks whose it is, and no token leaves it. */
export const revokeSession = (sessionId: string) =>
  coreMutationDocument(
    `/api/auth-management/sessions/${encodeURIComponent(sessionId)}/revoke`,
    "POST",
    undefined,
    "The session was not revoked.",
  );

export function reauthenticateForCurrentPage(): void {
  const target = new URL("/reauth", AUTH_URL);
  target.searchParams.set("redirect", window.location.href);
  window.location.assign(target);
}

export interface AccessPolicy {
  session: {
    concurrentLimit: number;
    freshAuthenticationMinutes: number;
    temporaryPasswordHours: number;
    trustedDeviceDays: number;
    twoFactorChallengeMinutes: number;
  };
}

export const accessPolicyQueryOptions = queryOptions({
  queryKey: ["admin", "access-policy"],
  queryFn: () =>
    coreReadDocument<AccessPolicy>(
      "/api/auth-management/access-policy",
      "Could not read the authentication policy.",
    ),
});

export type AccessScopeType = "subsidiary" | "team";

export interface BusinessPermission {
  breakGlass: boolean;
  description: string;
  key: string;
  label: string;
  privileged: boolean;
  scopes: AccessScopeType[];
}

export interface BusinessRole {
  archivedAt: string | Date | null;
  assignableScopes: AccessScopeType[];
  assignmentCount: number;
  description: string;
  id: string;
  invalidPermissions: string[];
  key: string;
  name: string;
  permissions: string[];
  privileged: boolean;
  system: boolean;
  updatedAt: string | Date;
}

export interface BusinessAssignment {
  active: boolean;
  expiresAt: string | Date | null;
  grantedAt: string | Date;
  grantedBy: string | null;
  id: string;
  inactiveReason:
    | "expired"
    | "left-subsidiary"
    | "left-team"
    | "mfa-required"
    | "revoked"
    | "role-archived"
    | null;
  organizationId: string;
  revokedAt: string | Date | null;
  role: Omit<
    BusinessRole,
    "assignableScopes" | "assignmentCount" | "invalidPermissions" | "privileged"
  >;
  roleId: string;
  teamId: string | null;
  userId: string;
}

export interface BusinessAccessPolicy {
  permissions: BusinessPermission[];
  roles: BusinessRole[];
}

export const businessAccessPolicyQueryOptions = queryOptions({
  queryKey: ["admin", "business-access-policy"],
  queryFn: () =>
    coreReadDocument<BusinessAccessPolicy>(
      "/api/access-control/policy",
      "Could not read business access policy.",
    ),
});

export const businessAssignmentsQueryOptions = queryOptions({
  queryKey: ["admin", "business-access-assignments"],
  queryFn: () =>
    coreReadDocument<BusinessAssignment[]>(
      "/api/access-control/assignments",
      "Could not read access assignments.",
    ),
});

export const createBusinessRole = (input: {
  description: string;
  key: string;
  name: string;
  permissions: string[];
}) =>
  coreMutationDocument<BusinessRole>(
    "/api/access-control/roles",
    "POST",
    input,
    "Could not create the role.",
  );

export const updateBusinessRole = (
  roleId: string,
  input: { description: string; name: string; permissions: string[] },
) =>
  coreMutationDocument<BusinessRole>(
    `/api/access-control/roles/${roleId}`,
    "PATCH",
    input,
    "Could not update the role.",
  );

export const archiveBusinessRole = (roleId: string) =>
  coreMutationDocument<{ archived: true }>(
    `/api/access-control/roles/${roleId}`,
    "DELETE",
    undefined,
    "Could not archive the role.",
  );

export const grantBusinessAssignment = (input: {
  expiresAt: string | null;
  organizationId: string;
  roleId: string;
  scope: AccessScopeType;
  teamId: string | null;
  userId: string;
}) =>
  coreMutationDocument<BusinessAssignment>(
    "/api/access-control/assignments",
    "POST",
    input,
    "Could not grant access.",
  );

export const revokeBusinessAssignment = (assignmentId: string) =>
  coreMutationDocument<{ revoked: true }>(
    `/api/access-control/assignments/${assignmentId}`,
    "DELETE",
    undefined,
    "Could not revoke access.",
  );

export const activateEmergencyAccess = (input: {
  organizationId: string;
  permission: string;
  reason: string;
  scope: AccessScopeType;
  teamId: string | null;
}) =>
  coreMutationDocument<{
    expiresAt: string | Date;
    id: string;
    organizationId: string;
    permission: string;
    reason: string;
    teamId: string | null;
  }>(
    "/api/access-control/break-glass",
    "POST",
    input,
    "Could not activate emergency access.",
  );

export const endEmergencyAccess = (elevationId: string) =>
  coreMutationDocument<{ ended: true }>(
    `/api/access-control/break-glass/${elevationId}`,
    "DELETE",
    undefined,
    "Could not end emergency access.",
  );

export const emergencyAccessQueryOptions = queryOptions({
  queryKey: ["admin", "emergency-access"],
  queryFn: () =>
    coreReadDocument<
      {
        id: string;
        expiresAt: string;
        organizationId: string;
        teamId: string | null;
        permission: string;
        reason: string;
      }[]
    >("/api/access-control/break-glass", "Could not read emergency access."),
});

export const savePosition = (input: {
  managerUserId: string | null;
  organizationId: string | null;
  title: string;
  userId: string;
}) =>
  coreMutationDocument<Position>(
    input.organizationId
      ? `/api/directory/positions/subsidiaries/${input.organizationId}/${input.userId}`
      : `/api/directory/positions/group/${input.userId}`,
    "PUT",
    { managerUserId: input.managerUserId, title: input.title },
    "Could not save the position.",
  );

export const removePosition = (input: {
  organizationId: string | null;
  userId: string;
}) =>
  coreMutationDocument<{ removed: true }>(
    input.organizationId
      ? `/api/directory/positions/subsidiaries/${input.organizationId}/${input.userId}`
      : `/api/directory/positions/group/${input.userId}`,
    "DELETE",
    undefined,
    "Could not remove the position.",
  );

export async function coreReadCollection<T>(
  path: string,
  failure: string,
): Promise<Collection<T>> {
  let page = await core<Collection<T>>(path, { failure });
  const data = [...page.data];
  const seen = new Set<string>();
  while (page.links.next && !seen.has(page.links.next)) {
    seen.add(page.links.next);
    page = await core<Collection<T>>(page.links.next, { failure });
    data.push(...page.data);
  }
  return { ...page, data, meta: { ...page.meta, total: data.length } };
}

export const coreReadCollectionPage = <T>(path: string, failure: string) =>
  core<Collection<T>>(path, { failure });

async function exhaustNested<TDocument, T>(
  initial: TDocument,
  select: (document: TDocument) => Collection<T>,
  failure: string,
  signal?: AbortSignal,
): Promise<T[]> {
  let page = select(initial);
  const data = [...page.data];
  const seen = new Set<string>();
  while (page.links.next && !seen.has(page.links.next)) {
    seen.add(page.links.next);
    const document = await coreReadDocument<TDocument>(
      page.links.next,
      failure,
      signal,
    );
    page = select(document);
    data.push(...page.data);
  }
  return data;
}

export const dashboardQueryOptions = queryOptions({
  queryKey: ["admin", "dashboard"],
  queryFn: async ({ signal }) => {
    const failure = "Could not read authentication activity.";
    const document = await coreReadDocument<DashboardDocument>(
      "/api/directory/dashboard?accessReviewPeopleLimit=100&attentionLimit=100&eventsLimit=100&peopleLimit=100",
      failure,
      signal,
    );
    const [privileged, attention, people] = await Promise.all([
      exhaustNested(
        document,
        (value) => value.accessReview.people,
        failure,
        signal,
      ),
      exhaustNested(document, (value) => value.attention, failure, signal),
      exhaustNested(document, (value) => value.people, failure, signal),
    ]);
    // The other three are lists of people and are bounded by the group; the
    // timeline is not, so it is the one page the server serves and nothing
    // here walks it. Draining it would put every sign-in ever recorded in the
    // browser to render the five the overview shows.
    return {
      ...document,
      accessReview: { ...document.accessReview, people: privileged },
      attention,
      events: document.events.data,
      people,
    };
  },
});

export const linkedAccountsQueryOptions = (userId: string) =>
  queryOptions({
    queryKey: ["admin", "people", userId, "accounts"],
    queryFn: () =>
      coreReadCollection<LinkedAccount>(
        `/api/directory/users/${userId}/accounts?limit=100`,
        "Could not read this person's linked accounts.",
      ).then((collection) => collection.data),
  });

/**
 * Where onboarding reaches one person.
 *
 * Its own request, one person at a time, because the column is `returned: false`
 * on the account: an admin acting on somebody reads their private address, and
 * an admin scanning a table never holds anyone's.
 */
export const personalEmailQueryOptions = (userId: string) =>
  queryOptions({
    queryKey: ["admin", "people", userId, "personal-email"],
    queryFn: () =>
      coreReadDocument<{ personalEmail: string | null }>(
        `/api/directory/users/${userId}/personal-email`,
        "Could not read this person's personal address.",
      ).then((document) => document.personalEmail),
  });

export const reviewPrivilegedAccess = (userId: string) =>
  coreMutationDocument<{ reviewed: true }>(
    `/api/directory/access-reviews/${userId}`,
    "POST",
    undefined,
    "Could not confirm this person's privileged access.",
  );

export const directoryQueryOptions = queryOptions({
  queryKey: ["admin", "directory"],
  queryFn: async ({ signal }) => {
    const failure = "Could not read the group.";
    const document = await coreReadDocument<{
      positions: Collection<Position>;
      subsidiaries: Collection<Subsidiary>;
      teams: Collection<Team & { memberIds: string[] }>;
    }>(
      "/api/directory?positionsLimit=100&subsidiariesLimit=100&teamsLimit=100",
      failure,
      signal,
    );
    const [positions, subsidiaries, teams] = await Promise.all([
      exhaustNested(document, (value) => value.positions, failure, signal),
      exhaustNested(document, (value) => value.subsidiaries, failure, signal),
      exhaustNested(document, (value) => value.teams, failure, signal),
    ]);
    return { positions, subsidiaries, teams };
  },
});

/** The names of each person's teams. */
export const teamNamesByUser = (
  directory: Directory | undefined,
): Record<string, string[]> => {
  const names: Record<string, string[]> = {};
  for (const team of directory?.teams ?? []) {
    for (const userId of team.memberIds) (names[userId] ??= []).push(team.name);
  }
  return names;
};

/**
 * A person's account standing, shared by the table and the detail row.
 *
 * "Suspended", not "banned": an account is closed here when someone leaves, is
 * under investigation, or has lost a device — not as moderation. Better Auth's
 * column and endpoint keep their own names; this is the word the company uses.
 */
export type Standing = "suspended" | "active";

/**
 * `banExpires` is read even though nothing sets it any more: Better Auth leaves
 * `banned` true once a timed ban lapses and only checks the date at sign-in, so
 * an account suspended before this app stopped offering durations can be open
 * while the column still says otherwise. Showing "Suspended" for someone who can
 * sign in is the one mistake this page must not make.
 */
export const standingOf = (person: Person): Standing => {
  if (!person.banned) return "active";
  const until = person.banExpires ? new Date(person.banExpires) : null;
  return until && until.getTime() <= Date.now() ? "active" : "suspended";
};

/**
 * What a mutation says when it lands. Both branches, always: a silent success is
 * indistinguishable from a silent failure, and every action on this surface
 * changes what someone else can reach.
 */
export const announce = {
  done: (title: string) => toast.add({ title, type: "success" }),
  /** A stale sign-in goes to re-authenticate; anything else is announced. */
  failed: (error: Error) => {
    if (
      error instanceof AdminApiError &&
      error.code === REFUSAL_CODES.sessionNotFresh
    )
      return reauthenticateForCurrentPage();
    toast.add({
      description: error.message,
      title: "That did not happen",
      type: "error",
    });
  },
};

export interface AccessReviewSubject {
  kind: "assignment" | "emergency";
  id: string;
  userId: string;
  grantedBy: string | null;
  organizationId: string;
  teamId: string | null;
  label: string;
  detail: string;
  snapshot: string;
  eligible: boolean;
  review: {
    decision: "confirmed" | "flagged";
    note: string;
    reviewedAt: string;
    reviewedBy: string | null;
  } | null;
}

export const accessReviewQueueQueryOptions = queryOptions({
  queryKey: ["admin", "access-review-queue"],
  queryFn: () =>
    coreReadDocument<AccessReviewSubject[]>(
      "/api/access-control/reviews",
      "Could not read business access reviews.",
    ),
});

export const recordBusinessAccessReview = (input: {
  subject: AccessReviewSubject;
  decision: "confirmed" | "flagged";
  note: string;
}) =>
  coreMutationDocument(
    `/api/access-control/reviews/${input.subject.kind}/${input.subject.id}`,
    "POST",
    {
      snapshot: input.subject.snapshot,
      decision: input.decision,
      note: input.note,
    },
    "Could not record the review.",
  );

export const teamDomainBindingsQueryOptions = queryOptions({
  queryKey: ["admin", "team-domain-bindings"],
  queryFn: () =>
    coreReadDocument<{ teamId: string; domainSlug: string }[]>(
      "/api/access-control/team-domains",
      "Could not read team domain links.",
    ),
});
export const bindTeamDomain = (teamId: string, domainSlug: string | null) =>
  coreMutationDocument(
    `/api/access-control/teams/${teamId}/domain`,
    "PUT",
    { domainSlug },
    "Could not change the team's domain.",
  );

export interface FactorRecoveryRequest {
  expired: boolean;
  id: string;
  userId: string;
  requestedBy: string | null;
  requestedAt: string;
  expiresAt: string;
  reason: string;
  evidence: string;
  completedAt: string | null;
  approvedBy: string | null;
  approvalEvidence: string | null;
}
export const factorRecoveryQueryOptions = queryOptions({
  queryKey: ["admin", "factor-recoveries"],
  queryFn: () =>
    coreReadDocument<FactorRecoveryRequest[]>(
      "/api/auth-management/recoveries",
      "Could not read recovery requests.",
    ),
});
/** After a change to accounts: every read that lists or counts people. */
export const refreshPeople = (queryClient: QueryClient) =>
  Promise.all(
    [
      ["admin", "people"],
      ["admin", "dashboard"],
      ["admin", "directory"],
    ].map((queryKey) => queryClient.invalidateQueries({ queryKey })),
  );
