/**
 * What `/api/access-control` answers with. Core's ports and services are typed
 * with these, so admin and the shell read what core actually sends.
 */

export const ACCESS_SCOPE_TYPES = ["subsidiary", "team"] as const;
export type AccessScopeType = (typeof ACCESS_SCOPE_TYPES)[number];

export interface PermissionDefinition {
  breakGlass: boolean;
  description: string;
  key: string;
  label: string;
  privileged: boolean;
  scopes: readonly AccessScopeType[];
}

export interface AccessRoleRecord {
  archivedAt: Date | null;
  createdAt: Date;
  description: string;
  id: string;
  key: string;
  name: string;
  permissions: string[];
  system: boolean;
  updatedAt: Date;
}

/** A role with what its permissions add up to, as the policy lists it. */
export interface AccessRoleView extends AccessRoleRecord {
  assignableScopes: AccessScopeType[];
  assignmentCount: number;
  /** Stored permissions the server no longer knows; a role holding one cannot be assigned. */
  invalidPermissions: string[];
  privileged: boolean;
}

export interface BusinessAccessPolicy {
  permissions: PermissionDefinition[];
  roles: AccessRoleView[];
}

export interface AccessAssignmentRecord {
  expiresAt: Date | null;
  grantedAt: Date;
  grantedBy: string | null;
  id: string;
  organizationId: string;
  revokedAt: Date | null;
  roleId: string;
  teamId: string | null;
  userId: string;
}

export type InactiveReason =
  | "expired"
  | "left-subsidiary"
  | "left-team"
  | "mfa-required"
  | "revoked"
  | "role-archived";

export interface AssignmentView extends AccessAssignmentRecord {
  active: boolean;
  inactiveReason: InactiveReason | null;
  role: AccessRoleRecord;
}

/** Emergency access a super administrator holds, for this session only. */
export interface EmergencyElevation {
  expiresAt: Date;
  id: string;
  organizationId: string;
  permission: string;
  reason: string;
  teamId: string | null;
}

export const REVIEW_KINDS = ["assignment", "emergency"] as const;
export const REVIEW_DECISIONS = ["confirmed", "flagged"] as const;
export type ReviewKind = (typeof REVIEW_KINDS)[number];
export type ReviewDecision = (typeof REVIEW_DECISIONS)[number];

export interface BusinessAccessReview {
  decision: ReviewDecision;
  id: string;
  kind: ReviewKind;
  note: string;
  reviewedAt: Date;
  reviewedBy: string | null;
  snapshot: string;
  subjectId: string;
}

/** One assignment or emergency elevation waiting for, or holding, a review. */
export interface AccessReviewSubject {
  detail: string;
  eligible: boolean;
  grantedBy: string | null;
  id: string;
  kind: ReviewKind;
  label: string;
  organizationId: string;
  review: BusinessAccessReview | null;
  /** A fingerprint of the access as listed; a review of a stale one is refused. */
  snapshot: string;
  teamId: string | null;
  userId: string;
}

export interface TeamDomain {
  domainSlug: string;
  teamId: string;
}

/** A working domain the signed-in person reaches through one of their teams. */
export interface DomainMembership extends TeamDomain {
  administered: boolean;
  organizationId: string;
}
