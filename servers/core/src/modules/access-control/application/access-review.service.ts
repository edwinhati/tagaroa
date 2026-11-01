import { createHash, randomUUID } from "node:crypto";

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";

import {
  AUDIT_TRAIL,
  type AuditTrail,
} from "../../audit/application/audit.facade";
import { requireOwnSession } from "../../auth/access-policy";
import {
  ACCESS_CONTROL_REPOSITORY,
  type AccessControlRepository,
} from "../domain/repositories/access-control.repository";
import {
  ACCESS_REVIEW_REPOSITORY,
  type AccessReviewRepository,
  type BusinessAccessReview,
  type ReviewKind,
} from "../domain/repositories/access-review.repository";

export interface AccessReviewSubject {
  kind: ReviewKind;
  id: string;
  userId: string;
  grantedBy: string | null;
  organizationId: string;
  teamId: string | null;
  label: string;
  detail: string;
  snapshot: string;
  eligible: boolean;
  review: BusinessAccessReview | null;
}

const fingerprint = (value: unknown): string =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");
const weekStart = (now: Date): Date => {
  const monday = new Date(now);
  monday.setUTCHours(0, 0, 0, 0);
  monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));
  return monday;
};

@Injectable()
export class AccessReviewService {
  constructor(
    @Inject(ACCESS_CONTROL_REPOSITORY)
    private readonly access: AccessControlRepository,
    @Inject(ACCESS_REVIEW_REPOSITORY)
    private readonly reviews: AccessReviewRepository,
    @Inject(AUDIT_TRAIL) private readonly audit: AuditTrail,
  ) {}

  async list(now = new Date()): Promise<AccessReviewSubject[]> {
    const [assignments, emergencies, reviews] = await Promise.all([
      this.access.listAssignments(),
      this.reviews.emergencies(),
      this.reviews.list(),
    ]);
    const subjects: AccessReviewSubject[] = [
      ...assignments
        .filter((row) => !row.revokedAt)
        .map((row): AccessReviewSubject => ({
          kind: "assignment",
          id: row.id,
          userId: row.userId,
          grantedBy: row.grantedBy,
          organizationId: row.organizationId,
          teamId: row.teamId,
          label: row.role.name,
          detail: row.expiresAt
            ? `Expires ${row.expiresAt.toISOString()}`
            : "No expiration",
          snapshot: fingerprint({
            ...row,
            role: {
              ...row.role,
              permissions: [...row.role.permissions].sort(),
            },
          }),
          eligible: row.active,
          review: null,
        })),
      ...emergencies.map((row): AccessReviewSubject => ({
        kind: "emergency",
        id: row.id,
        userId: row.userId,
        grantedBy: null,
        organizationId: row.organizationId,
        teamId: row.teamId,
        label: row.permission,
        detail: row.reason,
        snapshot: fingerprint({
          id: row.id,
          userId: row.userId,
          organizationId: row.organizationId,
          teamId: row.teamId,
          permission: row.permission,
          reason: row.reason,
          activatedAt: row.activatedAt,
          expiresAt: row.expiresAt,
          endedAt: row.endedAt,
        }),
        eligible: row.endedAt !== null || row.expiresAt <= now,
        review: null,
      })),
    ];
    const bySubject = new Map(
      reviews.map((review) => [`${review.kind}:${review.subjectId}`, review]),
    );
    for (const subject of subjects) {
      const review = bySubject.get(`${subject.kind}:${subject.id}`);
      if (
        review?.reviewedBy &&
        review.reviewedBy !== subject.userId &&
        review.reviewedBy !== subject.grantedBy &&
        review.snapshot === subject.snapshot &&
        (subject.kind === "emergency" || review.reviewedAt >= weekStart(now))
      )
        subject.review = review;
    }
    return subjects;
  }

  async record(
    kind: string,
    id: string,
    input: { snapshot?: unknown; decision?: unknown; note?: unknown },
    reviewer: { id: string; impersonatedBy?: string | null },
  ) {
    requireOwnSession(reviewer);
    const reviewerId = reviewer.id;
    if (kind !== "assignment" && kind !== "emergency")
      throw new BadRequestException("Unknown review type.");
    if (input.decision !== "confirmed" && input.decision !== "flagged")
      throw new BadRequestException("Choose confirmed or flagged.");
    if (
      typeof input.note !== "string" ||
      input.note.trim().length < 10 ||
      input.note.trim().length > 500
    )
      throw new BadRequestException(
        "Record the review evidence in 10 to 500 characters.",
      );
    const subject = (await this.list()).find(
      (row) => row.kind === kind && row.id === id,
    );
    if (!subject) throw new NotFoundException("Access record not found.");
    if (reviewerId === subject.userId || reviewerId === subject.grantedBy)
      throw new ForbiddenException(
        "A reviewer other than the account holder and grantor is required.",
      );
    if (!subject.eligible)
      throw new ConflictException(
        "Only active assignments and completed emergency access can be reviewed.",
      );
    if (input.snapshot !== subject.snapshot)
      throw new ConflictException(
        "Access changed. Reload it before reviewing.",
      );
    const review: BusinessAccessReview = {
      id: randomUUID(),
      kind,
      subjectId: id,
      snapshot: subject.snapshot,
      decision: input.decision,
      note: input.note.trim(),
      reviewedAt: new Date(),
      reviewedBy: reviewerId,
    };
    await this.reviews.record(review);
    await this.audit.record({
      actorId: reviewerId,
      targetUserId: subject.userId,
      type: `access.${kind}.reviewed`,
      detail: `${id}: ${review.decision}: ${review.note}`,
    });
    return review;
  }
}
