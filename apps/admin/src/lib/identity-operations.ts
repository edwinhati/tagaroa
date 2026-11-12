import type { AttentionKind } from "@repo/contracts/identity";

import type { AuthEvent } from "./admin";

/**
 * The attention the back office raises, most urgent first: recovery risk
 * before domain access gaps. A temporary password has its own panel.
 */
export const attentionCopy = {
  "unverified-email": {
    action: "Review",
    consequence: "Recovery and security messages may not reach them.",
    label: "Unverified email",
    title: "Email remains unverified",
  },
  "no-subsidiary": {
    action: "Assign access",
    consequence: "They cannot reach a working domain until they join a team.",
    label: "No subsidiary",
    title: "No subsidiary access",
  },
} satisfies Partial<
  Record<
    AttentionKind,
    { action: string; consequence: string; label: string; title: string }
  >
>;

export type VisibleAttentionKind = keyof typeof attentionCopy;

export const ATTENTION_ORDER = Object.keys(
  attentionCopy,
) as VisibleAttentionKind[];

export const isVisibleAttention = (
  kind: AttentionKind,
): kind is VisibleAttentionKind => Object.hasOwn(attentionCopy, kind);

/**
 * The trail speaks of suspending and restoring access. `user.banned` and
 * `user.unbanned` are the names the same two acts were written under before,
 * and they stay mapped: an event already in the table describes what happened
 * that day, and renaming it in place would be inventing a past.
 */
const eventActions: Record<string, string> = {
  "access.assignment.reviewed": "Reviewed a business assignment",
  "access.emergency.reviewed": "Reviewed emergency access",
  "access.team-domain.changed": "Changed a team's domain",
  "notification.suppression.removed": "Lifted a delivery suppression",
  "notification.template.created": "Drafted notification wording",
  "notification.template.deleted": "Deleted a notification draft",
  "notification.template.edited": "Edited notification wording",
  "notification.template.published": "Published notification wording",
  "subsidiary.updated": "Updated a subsidiary",
  "team.removed": "Removed a team",
  "team.updated": "Updated a team",
  "user.factor-recovery.requested": "Requested factor recovery",
  "user.factor-recovery.completed": "Completed factor recovery",
  "user.offboarded": "Offboarded an employee",
  "user.subsidiary.removed": "Removed subsidiary membership",

  "access.assignment.expiry-updated": "Changed the access expiry for",
  "access.assignment.granted": "Granted business access to",
  "access.assignment.revoked": "Revoked business access from",
  "access.break-glass.activated": "Activated emergency access",
  "access.break-glass.ended": "Ended emergency access",
  "access.break-glass.used": "Used emergency access",
  "access.role.archived": "Archived an access role",
  "access.role.created": "Created an access role",
  "access.role.updated": "Updated an access role",
  "directory.position.removed": "Removed the position for",
  "directory.position.updated": "Updated the position for",
  "user.banned": "Suspended access for",
  "user.created": "Issued an account to",
  "user.deleted": "Deleted an account",
  "user.domain-admin.granted": "Granted domain administration to",
  "user.domain-admin.revoked": "Revoked domain administration from",
  "user.impersonated": "Started impersonation for",
  "user.impersonation.ended": "Ended impersonation of",
  "user.privileged-access.reviewed": "Confirmed privileged access for",
  "user.profile.updated": "Changed the display name for",
  "user.restored": "Restored access for",
  "user.role.updated": "Updated the role for",
  "user.session.revoked": "Revoked a session for",
  "user.sessions.revoked": "Revoked every session for",
  "user.signed-in": "Recorded a sign-in for",
  "user.signed-in.passkey": "Recorded a passkey sign-in for",
  "user.suspended": "Suspended access for",
  "user.temporary-password.issued": "Issued a temporary password to",
  "user.two-factor.recovery-used": "Used a recovery code for",
  "user.two-factor.verified": "Verified two-factor for",
  "user.unbanned": "Restored access for",
  "user.updated": "Updated account details for",
};

export const eventAction = (event: AuthEvent): string =>
  eventActions[event.type] ?? event.type.replaceAll(".", " ");
