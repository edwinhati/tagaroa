export const ACCESS_REVIEW_REPOSITORY = Symbol(
  "BUSINESS_ACCESS_REVIEW_REPOSITORY",
);
export type ReviewKind = "assignment" | "emergency";
export type ReviewDecision = "confirmed" | "flagged";

export interface BusinessAccessReview {
  id: string;
  kind: ReviewKind;
  subjectId: string;
  snapshot: string;
  decision: ReviewDecision;
  note: string;
  reviewedAt: Date;
  reviewedBy: string | null;
}

export interface EmergencyAccessRecord {
  id: string;
  userId: string;
  organizationId: string;
  teamId: string | null;
  permission: string;
  reason: string;
  activatedAt: Date;
  expiresAt: Date;
  endedAt: Date | null;
}

export interface AccessReviewRepository {
  /** The newest review of each given subject. */
  latest(
    subjects: { kind: ReviewKind; id: string }[],
  ): Promise<BusinessAccessReview[]>;
  /** Recent elevations, plus any older one nobody has reviewed yet. */
  emergencies(): Promise<EmergencyAccessRecord[]>;
  record(review: BusinessAccessReview): Promise<void>;
}
