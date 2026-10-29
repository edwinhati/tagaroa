import { AccessReview } from "../../../domain/entities/access-review.entity";
import { Person } from "../../../domain/entities/person.entity";
import { Subsidiary, Team } from "../../../domain/entities/subsidiary.entity";

/**
 * Rows into entities.
 *
 * One file for the module's four, because each is a field-for-field lift and
 * splitting them would be four files that say the same thing. A mapper earns
 * its own file when it has a decision in it.
 */
export const personMapper = {
  toDomain: (row: {
    id: string;
    name: string;
    email: string;
    role: string | null;
    banned: boolean | null;
    emailVerified: boolean;
    mustChangePassword: boolean | null;
    createdAt: Date;
    updatedAt: Date;
  }): Person => Person.restore(row),
};

export const subsidiaryMapper = {
  toDomain: (row: { id: string; name: string; slug: string }): Subsidiary =>
    Subsidiary.restore(row),
};

export const teamMapper = {
  toDomain: (
    row: { id: string; name: string; organizationId: string },
    memberIds: readonly string[],
  ): Team => Team.restore({ ...row, memberIds: [...memberIds] }),
};

export const accessReviewMapper = {
  toDomain: (row: {
    userId: string;
    reviewedAt: Date;
    reviewedBy: string | null;
  }): AccessReview => AccessReview.restore(row),
};
