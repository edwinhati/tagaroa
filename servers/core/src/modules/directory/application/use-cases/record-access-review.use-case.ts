import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";

import {
  AUDIT_TRAIL,
  type AuditTrail,
} from "../../../audit/application/audit.facade";
import { type Operator, requireOwnSession } from "../../../auth/session-policy";
import {
  ACCESS_REVIEW_REPOSITORY,
  type AccessReviewRepository,
} from "../../domain/repositories/access-review.repository";
import {
  PERSON_REPOSITORY,
  type PersonRepository,
} from "../../domain/repositories/person.repository";

/**
 * An operator confirming that one privileged account is still intentional.
 *
 * The confirmation and its audit entry are the same act, which is why both are
 * written here rather than at the route: a review that leaves no trail is a
 * claim nobody can check later.
 */
@Injectable()
export class RecordAccessReviewUseCase {
  constructor(
    @Inject(ACCESS_REVIEW_REPOSITORY)
    private readonly reviews: AccessReviewRepository,
    @Inject(AUDIT_TRAIL) private readonly trail: AuditTrail,
    @Inject(PERSON_REPOSITORY) private readonly people: PersonRepository,
  ) {}

  async execute(
    userId: string,
    reviewer: Pick<Operator, "id"> & Partial<Pick<Operator, "impersonatedBy">>,
  ): Promise<void> {
    requireOwnSession(reviewer);
    const reviewerId = reviewer.id;
    if (userId === reviewerId) {
      throw new ForbiddenException(
        "Another operator must review your privileged access.",
      );
    }
    const person = (await this.people.listAll()).find(
      (person) => person.id === userId,
    );
    if (!person) throw new NotFoundException("Person not found.");
    if (person.banned || !person.privileged) {
      throw new BadRequestException(
        "Only active privileged accounts can be reviewed.",
      );
    }
    await this.reviews.record(userId, reviewerId, new Date());

    await this.trail.record({
      actorId: reviewerId,
      targetUserId: userId,
      type: "user.privileged-access.reviewed",
    });
  }
}
