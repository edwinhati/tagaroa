export const ACCESS_REVIEW_REPOSITORY = Symbol(
  "BUSINESS_ACCESS_REVIEW_REPOSITORY",
);
export const REVIEW_KINDS = ["assignment", "emergency"] as const;
export const REVIEW_DECISIONS = ["confirmed", "flagged"] as const;
export type ReviewKind = (typeof REVIEW_KINDS)[number];
export type ReviewDecision = (typeof REVIEW_DECISIONS)[number];

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
