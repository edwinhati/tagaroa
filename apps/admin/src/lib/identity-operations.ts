import type { AuthEvent, VisibleAttentionKind } from "./admin";

export const attentionCopy: Record<
  VisibleAttentionKind,
  { action: string; consequence: string; title: string }
> = {
  "unverified-email": {
    action: "Review",
    consequence: "Recovery and security messages may not reach them.",
    title: "Email remains unverified",
  },
  "no-subsidiary": {
    action: "Assign access",
    consequence: "They cannot reach a working domain until they join a team.",
    title: "No subsidiary access",
  },
};

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
  "user.privileged-access.reviewed": "Confirmed privileged access for",
  "user.restored": "Restored access for",
  "user.role.updated": "Updated the role for",
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

export const relativeTime = (
  value: string | Date,
  now: Date = new Date(),
): string => {
  const elapsed = Math.max(0, now.getTime() - new Date(value).getTime());
  const minutes = Math.floor(elapsed / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(value).toLocaleDateString();
};
