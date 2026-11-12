import { expect, test } from "bun:test";

import {
  adminAuditEvent,
  authenticationAuditEvent,
  endedSessionAuditEvent,
} from "./audit-events";

test("describes successful admin writes as durable audit events", () => {
  expect(
    adminAuditEvent(
      "/admin/create-user",
      { email: "person@tagaroa.test" },
      { user: { email: "person@tagaroa.test", id: "person-id" } },
    ),
  ).toEqual({
    detail: "person@tagaroa.test",
    targetUserId: "person-id",
    type: "user.created",
  });
  expect(
    adminAuditEvent(
      "/admin/set-role",
      { role: ["admin", "user"], userId: "person-id" },
      { user: { id: "person-id" } },
    ),
  ).toEqual({
    detail: "admin, user",
    targetUserId: "person-id",
    type: "user.role.updated",
  });
  expect(
    adminAuditEvent(
      "/admin/update-user",
      {
        data: { email: "new@tagaroa.test", name: "New name" },
        userId: "person-id",
      },
      { id: "person-id" },
    ),
  ).toEqual({
    detail: "email, name",
    targetUserId: "person-id",
    type: "user.updated",
  });
  expect(adminAuditEvent("/admin/list-users", {}, [])).toBeUndefined();
  expect(
    adminAuditEvent(
      "/organization/add-member",
      {
        organizationId: "subsidiary-id",
        role: "member",
        teamId: "team-id",
        userId: "person-id",
      },
      { id: "membership-id" },
    ),
  ).toEqual({
    detail: "subsidiary-id:team-id",
    targetUserId: "person-id",
    type: "user.subsidiary.added",
  });
  expect(
    adminAuditEvent(
      "/organization/remove-team-member",
      { teamId: "team-id", userId: "person-id" },
      { message: "Team member removed successfully." },
    ),
  ).toEqual({
    detail: "team-id",
    targetUserId: "person-id",
    type: "user.team.removed",
  });
});

test("describes successful authentication assurance events durably", () => {
  expect(
    authenticationAuditEvent(
      "/sign-in/email",
      { user: { id: "person-id" } },
      undefined,
    ),
  ).toEqual({
    actorId: "person-id",
    targetUserId: "person-id",
    type: "user.signed-in",
  });
  expect(
    authenticationAuditEvent("/two-factor/verify-backup-code", {}, "person-id"),
  ).toEqual({
    actorId: "person-id",
    targetUserId: "person-id",
    type: "user.two-factor.recovery-used",
  });
  expect(
    authenticationAuditEvent("/passkey/verify-registration", {}, "person-id"),
  ).toEqual({
    actorId: "person-id",
    targetUserId: "person-id",
    type: "user.passkey.added",
  });
  expect(
    authenticationAuditEvent("/update-user", { status: true }, "person-id"),
  ).toEqual({
    actorId: "person-id",
    targetUserId: "person-id",
    type: "user.profile.updated",
  });
  expect(
    authenticationAuditEvent(
      "/sign-in/email",
      { twoFactorRedirect: true, user: { id: "person-id" } },
      undefined,
    ),
  ).toBeUndefined();
});

test("subsidiary departure audit uses the removed member's identity, not the request identifier", () => {
  expect(
    adminAuditEvent(
      "/organization/remove-member",
      { memberIdOrEmail: "membership-id" },
      { member: { userId: "employee-id", organizationId: "subsidiary-id" } },
    ),
  ).toEqual({
    targetUserId: "employee-id",
    detail: "subsidiary-id",
    type: "user.subsidiary.removed",
  });
  expect(
    adminAuditEvent(
      "/organization/remove-member",
      { memberIdOrEmail: "membership-id" },
      {},
    ),
  ).toBeUndefined();
});

test("audits subsidiary and team edits made on Better Auth's own routes", () => {
  expect(
    adminAuditEvent(
      "/organization/update",
      { data: { name: "Renamed" }, organizationId: "subsidiary-id" },
      { id: "subsidiary-id", name: "Renamed" },
    ),
  ).toEqual({ detail: "subsidiary-id", type: "subsidiary.updated" });
  expect(
    adminAuditEvent(
      "/organization/update-team",
      { data: { name: "Renamed team" }, teamId: "team-id" },
      { id: "team-id", name: "Renamed team" },
    ),
  ).toEqual({ detail: "team-id", type: "team.updated" });
  expect(
    adminAuditEvent(
      "/organization/remove-team",
      { teamId: "team-id" },
      { message: "Team removed successfully." },
    ),
  ).toEqual({ detail: "team-id", type: "team.removed" });
  expect(adminAuditEvent("/organization/update", {}, null)).toBeUndefined();
});

test("audits the end of impersonation by the operator who started it", () => {
  expect(
    endedSessionAuditEvent("/admin/stop-impersonating", {
      impersonatedBy: "operator-id",
      userId: "person-id",
    }),
  ).toEqual({
    actorId: "operator-id",
    targetUserId: "person-id",
    type: "user.impersonation.ended",
  });
  // Signing out, or a fourth device evicting the oldest, is not an admin act.
  // A revoked session is audited by `IdentityOperationsService.revokeSession`.
  expect(
    endedSessionAuditEvent("/sign-out", { userId: "person-id" }),
  ).toBeUndefined();
});
