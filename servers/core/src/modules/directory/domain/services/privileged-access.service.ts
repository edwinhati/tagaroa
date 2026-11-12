import { type PrivilegedPerson } from "@repo/contracts/directory";

import { type AccessReview } from "../entities/access-review.entity";
import { type Person } from "../entities/person.entity";

/**
 * Who holds privileged access, and whether this week's confirmation still
 * stands. A banned account is left out: its access is already answered for.
 */
export const privilegedAccess = (
  people: readonly Person[],
  reviews: readonly AccessReview[],
  weekStart: Date,
): PrivilegedPerson[] => {
  const reviewByPerson = new Map(reviews.map((row) => [row.userId, row]));

  return people
    .filter((person) => !person.banned && person.privileged)
    .map((person) => {
      const review = reviewByPerson.get(person.id);
      return {
        email: person.email,
        name: person.name,
        reviewed: Boolean(review?.standsFor(person, weekStart)),
        reviewedAt: review?.reviewedAt ?? null,
        role: person.role ?? "admin",
        userId: person.id,
      };
    });
};
