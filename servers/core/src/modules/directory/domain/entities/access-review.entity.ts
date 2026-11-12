import type { Person } from "./person.entity";

export interface AccessReviewProps {
  userId: string;
  reviewedAt: Date;
  reviewedBy: string | null;
}

/**
 * An operator's confirmation that one privileged account is still intentional.
 *
 * A confirmation older than the person's own auth row is stale by definition,
 * so a role edit puts them back in the queue without anyone having to notice.
 * That rule is here rather than in the query because it is the whole meaning of
 * the record: the row says when, and only the comparison says whether it counts.
 */
export class AccessReview {
  private constructor(private readonly props: AccessReviewProps) {}

  static restore(props: AccessReviewProps): AccessReview {
    return new AccessReview(props);
  }

  get userId(): string {
    return this.props.userId;
  }

  get reviewedAt(): Date {
    return this.props.reviewedAt;
  }

  standsFor(person: Person, weekStart: Date): boolean {
    return (
      this.props.reviewedBy !== null &&
      this.props.reviewedBy !== person.id &&
      this.props.reviewedAt >= weekStart &&
      this.props.reviewedAt >= person.updatedAt
    );
  }
}
