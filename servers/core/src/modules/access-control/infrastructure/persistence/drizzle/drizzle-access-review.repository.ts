import { Inject, Injectable } from "@nestjs/common";
import { asc, sql } from "drizzle-orm";

import {
  DATABASE,
  type Database,
} from "../../../../../platform/database/database.module";
import type {
  AccessReviewRepository,
  BusinessAccessReview,
  ReviewDecision,
  ReviewKind,
} from "../../../domain/repositories/access-review.repository";
import { accessReview, breakGlassElevation } from "./schema";

@Injectable()
export class DrizzleAccessReviewRepository implements AccessReviewRepository {
  constructor(@Inject(DATABASE) private readonly database: Database) {}

  async list(): Promise<BusinessAccessReview[]> {
    const rows = await this.database
      .select()
      .from(accessReview)
      .orderBy(asc(accessReview.reviewedAt), asc(accessReview.id));
    return rows.map((row) => ({
      ...row,
      kind: row.kind as ReviewKind,
      decision: row.decision as ReviewDecision,
    }));
  }

  emergencies() {
    return this.database
      .select()
      .from(breakGlassElevation)
      .orderBy(asc(breakGlassElevation.activatedAt));
  }

  async record(review: BusinessAccessReview): Promise<void> {
    // Order concurrent decisions by database insertion time, including sub-millisecond precision.
    await this.database
      .insert(accessReview)
      .values({ ...review, reviewedAt: sql`clock_timestamp()` });
  }
}
