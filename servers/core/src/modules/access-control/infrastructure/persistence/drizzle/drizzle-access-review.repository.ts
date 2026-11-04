import { Inject, Injectable } from "@nestjs/common";
import {
  and,
  asc,
  desc,
  eq,
  gt,
  gte,
  inArray,
  isNotNull,
  ne,
  notExists,
  or,
  sql,
} from "drizzle-orm";
import { alias, type AnyPgColumn } from "drizzle-orm/pg-core";

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

const iso = (column: AnyPgColumn) =>
  sql`'"' || to_char(${column}, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') || '"'`;
const text = (column: AnyPgColumn) =>
  sql`coalesce(to_json(${column})::text, 'null')`;

/**
 * AccessReviewService's `fingerprint` of an emergency subject, rebuilt in SQL:
 * sha256 of JSON.stringify({id, userId, ... endedAt}) with dates as ISO strings.
 * Keep the key order and formats in step with that service. A drift only makes
 * old reviewed elevations stay listed, and access-review.integration.ts fails.
 */
const emergencyFingerprint = sql`encode(sha256(convert_to(concat(
  '{"id":', ${text(breakGlassElevation.id)},
  ',"userId":', ${text(breakGlassElevation.userId)},
  ',"organizationId":', ${text(breakGlassElevation.organizationId)},
  ',"teamId":', ${text(breakGlassElevation.teamId)},
  ',"permission":', ${text(breakGlassElevation.permission)},
  ',"reason":', ${text(breakGlassElevation.reason)},
  ',"activatedAt":', ${iso(breakGlassElevation.activatedAt)},
  ',"expiresAt":', ${iso(breakGlassElevation.expiresAt)},
  ',"endedAt":', coalesce(${iso(breakGlassElevation.endedAt)}, 'null'),
  '}'), 'UTF8')), 'hex')`;

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
    // An old elevation leaves the queue only once its newest review is one
    // AccessReviewService.list() would accept: a living reviewer other than
    // the holder, whose snapshot still matches the row (so a change made
    // between that check and the insert, e.g. ended_at, keeps it listed).
    const newer = alias(accessReview, "newer_review");
    const settled = this.database
      .select({ one: sql`1` })
      .from(accessReview)
      .where(
        and(
          eq(accessReview.kind, "emergency"),
          eq(accessReview.subjectId, breakGlassElevation.id),
          isNotNull(accessReview.reviewedBy),
          ne(accessReview.reviewedBy, breakGlassElevation.userId),
          sql`${accessReview.snapshot} = ${emergencyFingerprint}`,
          notExists(
            this.database
              .select({ one: sql`1` })
              .from(newer)
              .where(
                and(
                  eq(newer.kind, accessReview.kind),
                  eq(newer.subjectId, accessReview.subjectId),
                  or(
                    gt(newer.reviewedAt, accessReview.reviewedAt),
                    and(
                      eq(newer.reviewedAt, accessReview.reviewedAt),
                      gt(newer.id, accessReview.id),
                    ),
                  ),
                ),
              ),
          ),
        ),
      );
    return this.database
      .select()
      .from(breakGlassElevation)
      .where(
        or(
          gte(breakGlassElevation.activatedAt, sql`now() - interval '90 days'`),
          notExists(settled),
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
