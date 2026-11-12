import { type Wire } from "@repo/contracts";
import { type LinkedAccount } from "@repo/contracts/directory";
import {
  ADMIN_ROLE_IDS,
  type AuthenticationPolicy,
  type FactorRecoveryRequest,
  IDENTITY_ROLE_IDS,
} from "@repo/contracts/identity";
import { authClient } from "@repo/shell/auth-client";
import { type AuthSession } from "@repo/shell/create-auth-client";
import {
  keepPreviousData,
  type QueryClient,
  queryOptions,
} from "@tanstack/react-query";

import {
  coreMutationDocument,
  coreReadCollection,
  coreReadDocument,
} from "./api";
import {
  type CollectionSearch,
  facetValues,
  parseCollectionSearch,
} from "./collection-search";

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
export interface PeopleSearch extends CollectionSearch {
  role?: string;
  slice?: PeopleSlice;
}

/**
 * Sorting is the database's, so only the columns `auth.user` actually holds can
 * carry a sort header. Access sorts by role and nothing else — the team names
 * beside it are merged in on the page, and the database cannot order by them.
 */
export const PEOPLE_SORT_FIELDS = { access: "role", account: "name" } as const;

export type PeopleSortField = keyof typeof PEOPLE_SORT_FIELDS;

export function validatePeopleSearch(
  search: Record<string, unknown>,
): PeopleSearch {
  const collection = parseCollectionSearch(
    search,
    Object.keys(PEOPLE_SORT_FIELDS),
  );
  return {
    ...collection,
    // `listUsers` orders by one field.
    sort: collection.sort?.includes(",") ? undefined : collection.sort,
    role: facetValues(search.role, IDENTITY_ROLE_IDS)?.[0],
    slice:
      search.slice === "admins" || search.slice === "suspended"
        ? search.slice
        : undefined,
  };
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
      read<AuthSession[]>(
        () => authClient.admin.listUserSessions({ userId }),
        (data) => rows<AuthSession>(data, "sessions"),
        "Could not read this person's sessions.",
      ),
  });

/** One session, by id: core checks whose it is, and no token leaves it. */
export const revokeSession = (sessionId: string) =>
  coreMutationDocument(
    `/api/auth-management/sessions/${encodeURIComponent(sessionId)}/revoke`,
    "POST",
    undefined,
    "The session was not revoked.",
  );

export const accessPolicyQueryOptions = queryOptions({
  queryKey: ["admin", "access-policy"],
  queryFn: () =>
    coreReadDocument<AuthenticationPolicy>(
      "/api/auth-management/access-policy",
      "Could not read the authentication policy.",
    ),
});

export const linkedAccountsQueryOptions = (userId: string) =>
  queryOptions({
    queryKey: ["admin", "people", userId, "accounts"],
    queryFn: () =>
      coreReadCollection<Wire<LinkedAccount>>(
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

export type RecoveryRequest = Wire<FactorRecoveryRequest>;

export const factorRecoveryQueryOptions = queryOptions({
  queryKey: ["admin", "factor-recoveries"],
  queryFn: () =>
    coreReadDocument<RecoveryRequest[]>(
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
