import { Inject, Injectable } from "@nestjs/common";
import {
  and,
  asc,
  desc,
  eq,
  gte,
  inArray,
  notExists,
  or,
  sql,
} from "drizzle-orm";

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

  async latest(
    subjects: { kind: ReviewKind; id: string }[],
  ): Promise<BusinessAccessReview[]> {
    const ids = (kind: ReviewKind) =>
      subjects.filter((row) => row.kind === kind).map((row) => row.id);
    const [assignments, emergencies] = [ids("assignment"), ids("emergency")];
    const matches = [
      ...(assignments.length
        ? [
            and(
              eq(accessReview.kind, "assignment"),
              inArray(accessReview.subjectId, assignments),
            ),
          ]
        : []),
      ...(emergencies.length
        ? [
            and(
              eq(accessReview.kind, "emergency"),
              inArray(accessReview.subjectId, emergencies),
            ),
          ]
        : []),
    ];
    if (matches.length === 0) return [];
    const rows = await this.database
      .selectDistinctOn([accessReview.kind, accessReview.subjectId])
      .from(accessReview)
      .where(or(...matches))
      .orderBy(
        accessReview.kind,
        accessReview.subjectId,
        desc(accessReview.reviewedAt),
        desc(accessReview.id),
      );
    return rows.map((row) => ({
      ...row,
      kind: row.kind as ReviewKind,
      decision: row.decision as ReviewDecision,
    }));
  }

  // ponytail: 90-day window is fixed; make it a parameter if the queue needs a longer look-back.
  emergencies() {
    return this.database
      .select()
      .from(breakGlassElevation)
      .where(
        or(
          gte(breakGlassElevation.activatedAt, sql`now() - interval '90 days'`),
          notExists(
            this.database
              .select({ one: sql`1` })
              .from(accessReview)
              .where(
                and(
                  eq(accessReview.kind, "emergency"),
                  eq(accessReview.subjectId, breakGlassElevation.id),
                ),
              ),
          ),
        ),
      )
      .orderBy(asc(breakGlassElevation.activatedAt));
  }

  async record(review: BusinessAccessReview): Promise<void> {
    // Order concurrent decisions by database insertion time, including sub-millisecond precision.
    await this.database
      .insert(accessReview)
      .values({ ...review, reviewedAt: sql`clock_timestamp()` });
  }
}
