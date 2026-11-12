import { type AttentionIssue } from "@repo/contracts/directory";

import { type Person } from "../entities/person.entity";

/**
 * Everything the group should act on, across everybody.
 *
 * A service rather than a method because the question spans people: whether an
 * account is in no subsidiary can only be answered against the whole membership
 * list, which no single `Person` holds.
 */
export const attentionFor = (
  people: readonly Person[],
  membershipIds: ReadonlySet<string>,
  now: Date,
): AttentionIssue[] =>
  people.flatMap((person) =>
    person.attention(membershipIds.has(person.id), now),
  );
