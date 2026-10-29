import { randomUUID } from "node:crypto";

import { Inject, Injectable } from "@nestjs/common";

import {
  DATABASE,
  type Database,
} from "../../../../../platform/database/database.module";
import type { AccessReview } from "../../../domain/entities/access-review.entity";
import type { AccessReviewRepository } from "../../../domain/repositories/access-review.repository";
import { accessReviewMapper } from "./directory.mappers";
import { privilegedAccessReview } from "./schema";

@Injectable()
export class DrizzleAccessReviewRepository implements AccessReviewRepository {
  constructor(@Inject(DATABASE) private readonly database: Database) {}

  async listAll(): Promise<AccessReview[]> {
    const rows = await this.database
      .select({
        reviewedAt: privilegedAccessReview.reviewedAt,
        reviewedBy: privilegedAccessReview.reviewedBy,
        userId: privilegedAccessReview.userId,
      })
      .from(privilegedAccessReview);

    return rows.map(accessReviewMapper.toDomain);
  }

  /** Upserted: the question is when this was last confirmed, not how often. */
  async record(
    userId: string,
    reviewerId: string,
    reviewedAt: Date,
  ): Promise<void> {
    await this.database
      .insert(privilegedAccessReview)
      .values({ id: randomUUID(), reviewedAt, reviewedBy: reviewerId, userId })
      .onConflictDoUpdate({
        set: { reviewedAt, reviewedBy: reviewerId },
        target: privilegedAccessReview.userId,
      });
  }
}
