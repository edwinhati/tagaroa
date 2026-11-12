import { PAGE_SIZE, type Collection, type Wire } from "@repo/contracts";
import {
  type AttentionIssue,
  type DashboardModel,
  type DirectorySubsidiary,
  type DirectoryTeam,
  type GroupSnapshot,
  type PersonActivityView,
  type PositionRecord,
  type PrivilegedPerson,
  type TimelineEntry,
} from "@repo/contracts/directory";
import { type SavePositionBody } from "@repo/contracts/requests/directory";
import { queryOptions } from "@tanstack/react-query";

import { coreMutationDocument, coreReadDocument, exhaustNested } from "./api";

export type AuthEvent = Wire<TimelineEntry>;

export type IdentityIssue = Wire<AttentionIssue>;

/** The overview as sent: its lists arrive one page at a time. */
type DashboardDocument = Wire<
  Omit<DashboardModel, "accessReview" | "attention" | "events" | "people"> & {
    accessReview: Omit<DashboardModel["accessReview"], "people"> & {
      people: Collection<PrivilegedPerson>;
    };
    attention: Collection<AttentionIssue>;
    events: Collection<TimelineEntry>;
    people: Collection<PersonActivityView>;
  }
>;

/**
 * The whole group in one read, from `servers/core`'s /directory.
 *
 * Better Auth's own endpoints cannot answer this: `/organization/list` is scoped
 * to the caller's memberships and `/organization/list-team-members` refuses a
 * caller who is not in the team. An admin oversees teams they are not in, so the
 * core service reads the tables instead — behind the same role. Writes still go
 * through Better Auth.
 */
export type Directory = Wire<GroupSnapshot>;

export const savePosition = (
  input: Wire<SavePositionBody> & {
    organizationId: string | null;
    userId: string;
  },
) =>
  coreMutationDocument<Wire<PositionRecord>>(
    input.organizationId
      ? `/api/directory/positions/subsidiaries/${input.organizationId}/${input.userId}`
      : `/api/directory/positions/group/${input.userId}`,
    "PUT",
    {
      managerUserId: input.managerUserId,
      title: input.title,
    } satisfies Wire<SavePositionBody>,
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

export const dashboardQueryOptions = queryOptions({
  queryKey: ["admin", "dashboard"],
  queryFn: async ({ signal }) => {
    const failure = "Could not read authentication activity.";
    const document = await coreReadDocument<DashboardDocument>(
      `/api/directory/dashboard?accessReviewPeopleLimit=${PAGE_SIZE.max}&attentionLimit=${PAGE_SIZE.max}&eventsLimit=${PAGE_SIZE.max}&peopleLimit=${PAGE_SIZE.max}`,
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
    const document = await coreReadDocument<
      Wire<{
        positions: Collection<PositionRecord>;
        subsidiaries: Collection<DirectorySubsidiary>;
        teams: Collection<DirectoryTeam>;
      }>
    >(
      `/api/directory?positionsLimit=${PAGE_SIZE.max}&subsidiariesLimit=${PAGE_SIZE.max}&teamsLimit=${PAGE_SIZE.max}`,
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
