import { asObject } from "@repo/contracts";

/** Which Better Auth calls the audit trail records, and as what. */

export interface AuthAuditInput {
  actorId: string | null;
  detail?: string;
  targetUserId?: string;
  type: string;
}

type PendingAuditEvent = Omit<AuthAuditInput, "actorId">;

/** Authentication evidence that must outlive the session or factor row. */
export const authenticationAuditEvent = (
  path: string,
  returned: unknown,
  sessionUserId: string | undefined,
): AuthAuditInput | undefined => {
  const response = asObject(returned);
  const returnedUser = asObject(response?.user);
  const actorId =
    sessionUserId ??
    (typeof returnedUser?.id === "string" ? returnedUser.id : undefined);
  if (!actorId) return undefined;

  let type: string | undefined;
  switch (path) {
    case "/sign-in/email":
      if (response?.twoFactorRedirect === true) return undefined;
      type = "user.signed-in";
      break;
    case "/two-factor/verify-totp":
      type = "user.two-factor.verified";
      break;
    case "/two-factor/verify-backup-code":
      type = "user.two-factor.recovery-used";
      break;
    case "/passkey/verify-registration":
      type = "user.passkey.added";
      break;
    case "/passkey/delete-passkey":
      type = "user.passkey.removed";
      break;
    case "/passkey/verify-authentication":
      type = "user.signed-in.passkey";
      break;
    case "/revoke-session":
      type = "user.session.revoked";
      break;
    case "/revoke-sessions":
      type = "user.sessions.revoked";
      break;
    case "/update-user":
      type = "user.profile.updated";
      break;
    default:
      return undefined;
  }
  return { actorId, targetUserId: actorId, type };
};

/**
 * The successful Better Auth admin calls that change another person's access.
 * Reads are intentionally absent. A deleted person cannot remain a foreign-key
 * target, so that event retains the old user id as detail instead.
 */
export const adminAuditEvent = (
  path: string,
  body: unknown,
  returned: unknown,
): PendingAuditEvent | undefined => {
  const request = asObject(body);
  const responseUser = asObject(asObject(returned)?.user);
  const requestedUserId =
    typeof request?.userId === "string" ? request.userId : undefined;

  switch (path) {
    case "/admin/create-user":
      return typeof responseUser?.id === "string"
        ? {
            detail:
              typeof responseUser.email === "string"
                ? responseUser.email
                : undefined,
            targetUserId: responseUser.id,
            type: "user.created",
          }
        : undefined;
    case "/admin/set-role": {
      const role = Array.isArray(request?.role)
        ? request.role.join(", ")
        : request?.role;
      return requestedUserId
        ? {
            detail: typeof role === "string" ? role : undefined,
            targetUserId: requestedUserId,
            type: "user.role.updated",
          }
        : undefined;
    }
    case "/admin/update-user": {
      const data = asObject(request?.data);
      const fields = data ? Object.keys(data).sort().join(", ") : undefined;
      return requestedUserId
        ? {
            detail: fields || undefined,
            targetUserId: requestedUserId,
            type: "user.updated",
          }
        : undefined;
    }
    // Better Auth's own vocabulary is "ban", and its path and column keep that
    // name. The trail records what the act means here: an account is suspended
    // when someone leaves or is under investigation, and restored when they come
    // back. Rows written before this carry "user.banned" / "user.unbanned" and
    // are still rendered — an audit trail is not rewritten to match new words.
    case "/admin/ban-user":
      return requestedUserId
        ? {
            detail:
              typeof request?.banReason === "string"
                ? request.banReason
                : undefined,
            targetUserId: requestedUserId,
            type: "user.suspended",
          }
        : undefined;
    case "/admin/unban-user":
      return requestedUserId
        ? { targetUserId: requestedUserId, type: "user.restored" }
        : undefined;
    case "/admin/revoke-user-sessions":
      return requestedUserId
        ? {
            targetUserId: requestedUserId,
            type: "user.sessions.revoked",
          }
        : undefined;
    case "/admin/set-user-password":
      return requestedUserId
        ? {
            targetUserId: requestedUserId,
            type: "user.temporary-password.issued",
          }
        : undefined;
    case "/admin/remove-user":
      return requestedUserId
        ? { detail: requestedUserId, type: "user.deleted" }
        : undefined;
    case "/admin/impersonate-user":
      return requestedUserId
        ? { targetUserId: requestedUserId, type: "user.impersonated" }
        : undefined;
    case "/organization/add-member": {
      const organizationId = request?.organizationId;
      const teamId = request?.teamId;
      const detail = [organizationId, teamId]
        .filter((value): value is string => typeof value === "string")
        .join(":");
      return requestedUserId
        ? {
            detail: detail || undefined,
            targetUserId: requestedUserId,
            type: "user.subsidiary.added",
          }
        : undefined;
    }
    case "/organization/add-team-member":
      return requestedUserId
        ? {
            detail:
              typeof request?.teamId === "string" ? request.teamId : undefined,
            targetUserId: requestedUserId,
            type: "user.team.added",
          }
        : undefined;
    case "/organization/remove-member": {
      const removed = asObject(asObject(returned)?.member);
      return typeof removed?.userId === "string"
        ? {
            targetUserId: removed.userId,
            detail:
              typeof removed.organizationId === "string"
                ? removed.organizationId
                : undefined,
            type: "user.subsidiary.removed",
          }
        : undefined;
    }
    case "/organization/remove-team-member":
      return requestedUserId
        ? {
            detail:
              typeof request?.teamId === "string" ? request.teamId : undefined,
            targetUserId: requestedUserId,
            type: "user.team.removed",
          }
        : undefined;
    // Better Auth answers an update with the row as it now stands.
    case "/organization/update": {
      const id = asObject(returned)?.id;
      return typeof id === "string"
        ? { detail: id, type: "subsidiary.updated" }
        : undefined;
    }
    case "/organization/update-team": {
      const id = asObject(returned)?.id;
      return typeof id === "string"
        ? { detail: id, type: "team.updated" }
        : undefined;
    }
    case "/organization/remove-team":
      return typeof request?.teamId === "string"
        ? { detail: request.teamId, type: "team.removed" }
        : undefined;
    default:
      return undefined;
  }
};

/**
 * The admin acts that end one session without naming whose it was. The request
 * carries only the token, and the row is gone by the time the after hook runs,
 * so these are read from the session delete hook, where the deleted row still
 * names its owner. The token itself is never recorded.
 */
export const endedSessionAuditEvent = (
  path: string | undefined,
  session: { impersonatedBy?: unknown; userId: string },
): AuthAuditInput | undefined => {
  switch (path) {
    // The ended session belongs to the person impersonated; the operator is
    // the one it names as having started it.
    case "/admin/stop-impersonating":
      return typeof session.impersonatedBy === "string"
        ? {
            actorId: session.impersonatedBy,
            targetUserId: session.userId,
            type: "user.impersonation.ended",
          }
        : undefined;
    default:
      return undefined;
  }
};
