import type { AccessReview } from "../entities/access-review.entity";

export const ACCESS_REVIEW_REPOSITORY = Symbol("ACCESS_REVIEW_REPOSITORY");

/**
 * The latest confirmation per privileged person.
 *
 * `record` upserts, because the question is "when was this last confirmed", not
 * "how many times" — the trail already keeps the history.
 */
export interface AccessReviewRepository {
  listAll(): Promise<AccessReview[]>;
  record(userId: string, reviewerId: string, reviewedAt: Date): Promise<void>;
}
