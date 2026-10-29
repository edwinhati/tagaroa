import type { Person } from "../entities/person.entity";

/**
 * An audit entry as the timeline needs it.
 *
 * Declared here rather than imported from `audit` so that the rule below owes
 * that module nothing: the trail could become a service on another machine and
 * this file would not change. The use case does the one translation.
 */
export interface TrailEntry {
  id: string;
  type: string;
  actorId: string | null;
  targetUserId: string | null;
  detail: string | null;
  createdAt: Date;
}

export interface SignIn {
  id: string;
  userId: string;
  ipAddress: string | null;
  at: Date;
}

export interface TimelineEntry {
  id: string;
  type: string;
  actor: string;
  target: string | null;
  detail: string | null;
  at: Date;
}

/**
 * How far back the dashboard's timeline reaches.
 *
 * The trail and the sign-in log both grow without bound, and sign-ins grow far
 * faster — so an unbounded read would eventually mean loading a year of
 * sign-ins to show the last five changes. A depth belongs here rather than in
 * the query string because it bounds the work, not the page: the caller reads
 * this many of each source, and `timeline` keeps this many of the merge.
 */
export const TIMELINE_DEPTH = 200;

/**
 * The audit trail and the sign-in log as one list, newest first.
 *
 * Addresses are resolved here rather than joined in SQL because an event
 * outlives the person it names: a deleted actor has to read as something, and
 * "Deleted operator" is more use than a dangling id.
 *
 * Taking `depth` from each source and keeping `depth` of the merge is the whole
 * answer, not an approximation of one: an entry in the newest `depth` overall
 * is in the newest `depth` of the source it came from.
 */
/**
 * Who did something nobody signed in to do. A null actor is either a system of
 * record acting — which always names itself in the detail — or an operator
 * whose account was since deleted, which the foreign key also nulls.
 */
const SYSTEM_ACTORS = ["Frappe HR"] as const;

const unattributed = (detail: string | null): string =>
  SYSTEM_ACTORS.find((system) => detail?.includes(system)) ??
  "Deleted operator";

export const timeline = (
  events: readonly TrailEntry[],
  signIns: readonly SignIn[],
  people: readonly Person[],
  depth: number = TIMELINE_DEPTH,
): TimelineEntry[] => {
  const emailOf = new Map(people.map((person) => [person.id, person.email]));

  return [
    ...events.map((event) => ({
      actor:
        (event.actorId && emailOf.get(event.actorId)) ??
        unattributed(event.detail),
      at: event.createdAt,
      detail: event.detail,
      id: event.id,
      target:
        (event.targetUserId && emailOf.get(event.targetUserId)) ??
        event.detail ??
        null,
      type: event.type,
    })),
    ...signIns.map((row) => ({
      actor: "Authentication service",
      at: row.at,
      detail: row.ipAddress,
      id: `session:${row.id}`,
      target: emailOf.get(row.userId) ?? "Deleted person",
      type: "user.signed-in",
    })),
  ]
    .sort((first, second) => second.at.getTime() - first.at.getTime())
    .slice(0, depth);
};
