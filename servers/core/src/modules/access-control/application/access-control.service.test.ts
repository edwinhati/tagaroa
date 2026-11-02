import { describe, expect, mock, setSystemTime, test } from "bun:test";

import type { AuditTrail } from "../../audit/application/audit.facade";
import type {
  AccessAssignmentRecord,
  AccessControlRepository,
  AccessRoleRecord,
  AssignmentView,
} from "../domain/repositories/access-control.repository";
import {
  AccessControlService,
  type AccessActor,
} from "./access-control.service";

const NOW = new Date("2026-09-01T12:00:00.000Z");

const role: AccessRoleRecord = {
  archivedAt: null,
  createdAt: NOW,
  description: "Changes configuration for assigned domains.",
  id: "role-domain-admin",
  key: "domain-administrator",
  name: "Domain administrator",
  permissions: ["domain:administer"],
  system: true,
  updatedAt: NOW,
};

const actor = (overrides: Partial<AccessActor> = {}): AccessActor => ({
  id: "operator",
  identityRole: "super-admin",
  sessionCreatedAt: new Date("2026-09-01T11:55:00.000Z"),
  sessionId: "session-1",
  ...overrides,
});

const repository = (overrides: Partial<AccessControlRepository> = {}) => {
  const granted: AccessAssignmentRecord[] = [];
  const elevations: string[] = [];
  const implementation: AccessControlRepository = {
    activeElevations: async () => [],
    archiveRole: async () => true,
    createRole: async () => undefined,
    endElevation: async () => true,
    findActiveAssignment: async () => null,
    findRole: async () => role,
    grantAssignment: async (input) => {
      granted.push({ ...input, grantedAt: NOW, revokedAt: null });
    },
    grantElevation: async (input) => {
      elevations.push(input.id);
    },
    hasActiveElevation: async () => false,
    hasEffectivePermission: async () => false,
    isOrganizationMember: async () => true,
    isTeamMember: async () => true,
    listAssignments: async () => [],
    listRoles: async () => [role],
    organizationExists: async () => true,
    revokeAssignment: async () => null,
    roleHasActiveAssignments: async () => false,
    roleKeyOrNameExists: async () => false,
    teamOrganizationId: async () => "subsidiary-1",
    updateAssignmentExpiry: async () => null,
    updateRole: async () => true,
    userHasTwoFactor: async () => true,
    ...overrides,
  };
  return { elevations, granted, implementation };
};

const audit: AuditTrail = {
  recent: async () => [],
  record: async () => undefined,
};

const assignmentInput = {
  expiresAt: null,
  organizationId: "subsidiary-1",
  roleId: role.id,
  scope: "team" as const,
  teamId: "team-1",
  userId: "person-1",
};

const roleInput = {
  description: "Configure assigned domains",
  key: "custom-admin",
  name: "Custom administrator",
  permissions: ["domain:administer"],
};

const assignment: AssignmentView = {
  ...assignmentInput,
  id: "assignment-1",
  grantedAt: NOW,
  grantedBy: "operator",
  revokedAt: null,
  active: true,
  inactiveReason: null,
  role,
};

const auditSpy = () => ({
  recent: async () => [],
  record: mock<AuditTrail["record"]>(async () => undefined),
});

describe("role lifecycle", () => {
  test("creates and edits custom roles with an audit event", async () => {
    const createRole = mock<AccessControlRepository["createRole"]>(
      async () => undefined,
    );
    const updateRole = mock<AccessControlRepository["updateRole"]>(
      async () => true,
    );
    const duplicate = mock<AccessControlRepository["roleKeyOrNameExists"]>(
      async () => false,
    );
    const store = repository({
      createRole,
      updateRole,
      roleKeyOrNameExists: duplicate,
      findRole: async () => ({ ...role, system: false }),
    });
    const trail = auditSpy();
    const service = new AccessControlService(store.implementation, trail);
    await service.createRole(roleInput, actor(), NOW);
    expect(createRole).toHaveBeenCalledWith({
      ...roleInput,
      id: expect.any(String),
      userId: "operator",
    });
    await service.updateRole(role.id, roleInput, actor(), NOW);
    expect(duplicate).toHaveBeenLastCalledWith(
      role.key,
      roleInput.name,
      role.id,
    );
    expect(updateRole).toHaveBeenCalledWith({
      description: roleInput.description,
      name: roleInput.name,
      permissions: roleInput.permissions,
      id: role.id,
      userId: "operator",
    });
    expect(trail.record.mock.calls.map(([event]) => event.type)).toEqual([
      "access.role.created",
      "access.role.updated",
    ]);
  });

  test("duplicate names and stale sessions leave roles unchanged", async () => {
    const createRole = mock<AccessControlRepository["createRole"]>(
      async () => undefined,
    );
    const updateRole = mock<AccessControlRepository["updateRole"]>(
      async () => true,
    );
    const store = repository({
      createRole,
      updateRole,
      roleKeyOrNameExists: async () => true,
      findRole: async () => ({ ...role, system: false }),
    });
    const trail = auditSpy();
    const service = new AccessControlService(store.implementation, trail);
    await expect(service.createRole(roleInput, actor(), NOW)).rejects.toThrow(
      "already uses",
    );
    await expect(
      service.updateRole(role.id, roleInput, actor(), NOW),
    ).rejects.toThrow("already uses");
    const stale = actor({
      sessionCreatedAt: new Date(NOW.getTime() - 15 * 60_000),
    });
    await expect(service.createRole(roleInput, stale, NOW)).rejects.toThrow(
      "Sign in again",
    );
    await expect(
      service.updateRole(role.id, roleInput, stale, NOW),
    ).rejects.toThrow("Sign in again");
    await expect(service.archiveRole(role.id, stale, NOW)).rejects.toThrow(
      "Sign in again",
    );
    expect(createRole).not.toHaveBeenCalled();
    expect(updateRole).not.toHaveBeenCalled();
    expect(trail.record).not.toHaveBeenCalled();
  });

  test("archived and built-in roles reject edits and archiving", async () => {
    for (const existing of [null, { ...role, archivedAt: NOW }, role]) {
      const updateRole = mock<AccessControlRepository["updateRole"]>(
        async () => true,
      );
      const archiveRole = mock<AccessControlRepository["archiveRole"]>(
        async () => true,
      );
      const store = repository({
        findRole: async () => existing,
        updateRole,
        archiveRole,
      });
      const trail = auditSpy();
      const service = new AccessControlService(store.implementation, trail);
      const message = existing === role ? "Built-in roles" : "Role not found";
      await expect(
        service.updateRole(role.id, roleInput, actor(), NOW),
      ).rejects.toThrow(message);
      await expect(service.archiveRole(role.id, actor(), NOW)).rejects.toThrow(
        message,
      );
      expect(updateRole).not.toHaveBeenCalled();
      expect(archiveRole).not.toHaveBeenCalled();
      expect(trail.record).not.toHaveBeenCalled();
    }
  });

  test("archive refuses active assignments instead of silently revoking them", async () => {
    const archiveRole = mock<AccessControlRepository["archiveRole"]>(
      async () => true,
    );
    const revokeAssignment = mock<AccessControlRepository["revokeAssignment"]>(
      async () => null,
    );
    const active = mock<AccessControlRepository["roleHasActiveAssignments"]>(
      async () => true,
    );
    const store = repository({
      archiveRole,
      revokeAssignment,
      roleHasActiveAssignments: active,
      findRole: async () => ({ ...role, system: false }),
    });
    const trail = auditSpy();
    const service = new AccessControlService(store.implementation, trail);
    await expect(service.archiveRole(role.id, actor(), NOW)).rejects.toThrow(
      "Revoke or expire",
    );
    expect(active).toHaveBeenCalledWith(role.id, NOW);
    expect(archiveRole).not.toHaveBeenCalled();
    expect(trail.record).not.toHaveBeenCalled();
    active.mockResolvedValue(false);
    expect(await service.archiveRole(role.id, actor(), NOW)).toEqual({
      archived: true,
    });
    expect(archiveRole).toHaveBeenCalledWith(role.id, "operator", NOW);
    expect(revokeAssignment).not.toHaveBeenCalled();
    expect(trail.record).toHaveBeenCalledWith({
      actorId: "operator",
      detail: role.key,
      type: "access.role.archived",
    });
  });
});

describe("assignment scope validation", () => {
  test("rejects missing subsidiaries, missing teams and mismatched parents before writing", async () => {
    for (const scenario of [
      {
        organizationExists: false,
        teamId: "team-1",
        parent: "subsidiary-1",
        scope: "team",
        message: "Subsidiary not found",
      },
      {
        organizationExists: true,
        teamId: null,
        parent: null,
        scope: "team",
        message: "Choose a team",
      },
      {
        organizationExists: true,
        teamId: "team-1",
        parent: null,
        scope: "team",
        message: "does not belong",
      },
      {
        organizationExists: true,
        teamId: "team-1",
        parent: "subsidiary-2",
        scope: "team",
        message: "does not belong",
      },
      {
        organizationExists: true,
        teamId: "team-1",
        parent: "subsidiary-1",
        scope: "subsidiary",
        message: "cannot include a team",
      },
    ] as const) {
      const store = repository({
        organizationExists: async () => scenario.organizationExists,
        teamOrganizationId: async () => scenario.parent,
      });
      const trail = auditSpy();
      const service = new AccessControlService(store.implementation, trail);
      await expect(
        service.grantAssignment(
          {
            ...assignmentInput,
            teamId: scenario.teamId,
            scope: scenario.scope,
          },
          actor(),
          NOW,
        ),
      ).rejects.toThrow(scenario.message);
      expect(store.granted).toEqual([]);
      expect(trail.record).not.toHaveBeenCalled();
    }
  });

  test("roles with undeclared permissions cannot be assigned", async () => {
    const store = repository({
      findRole: async () => ({ ...role, permissions: ["unknown:permission"] }),
    });
    const service = new AccessControlService(store.implementation, audit);
    await expect(
      service.grantAssignment(assignmentInput, actor(), NOW),
    ).rejects.toThrow("does not know");
    expect(store.granted).toEqual([]);
  });
});

describe("assignment expiry and revocation", () => {
  test("past and current expiration dates cannot change or create an assignment", async () => {
    const update = mock<AccessControlRepository["updateAssignmentExpiry"]>(
      async () => assignment,
    );
    const store = repository({
      listAssignments: async () => [assignment],
      updateAssignmentExpiry: update,
    });
    const trail = auditSpy();
    const service = new AccessControlService(store.implementation, trail);
    for (const expiresAt of [new Date(NOW.getTime() - 1), NOW]) {
      await expect(
        service.updateAssignmentExpiry(assignment.id, expiresAt, actor(), NOW),
      ).rejects.toThrow("in the future");
      await expect(
        service.grantAssignment(
          { ...assignmentInput, expiresAt },
          actor(),
          NOW,
        ),
      ).rejects.toThrow("in the future");
    }
    expect(update).not.toHaveBeenCalled();
    expect(store.granted).toEqual([]);
    expect(trail.record).not.toHaveBeenCalled();
  });

  test("privileged expiry changes require a super-admin and fresh session", async () => {
    const update = mock<AccessControlRepository["updateAssignmentExpiry"]>(
      async () => assignment,
    );
    const store = repository({
      listAssignments: async () => [assignment],
      updateAssignmentExpiry: update,
    });
    const service = new AccessControlService(store.implementation, audit);
    await expect(
      service.updateAssignmentExpiry(
        assignment.id,
        null,
        actor({ identityRole: "admin" }),
        NOW,
      ),
    ).rejects.toThrow("Only a super administrator");
    await expect(
      service.updateAssignmentExpiry(
        assignment.id,
        null,
        actor({ sessionCreatedAt: new Date(NOW.getTime() - 15 * 60_000) }),
        NOW,
      ),
    ).rejects.toThrow("Sign in again");
    expect(update).not.toHaveBeenCalled();
  });

  test("expiry changes and revocation record their actor, target and details", async () => {
    const update = mock<AccessControlRepository["updateAssignmentExpiry"]>(
      async () => assignment,
    );
    const revoke = mock<AccessControlRepository["revokeAssignment"]>(
      async () => assignment,
    );
    const store = repository({
      listAssignments: async () => [assignment],
      updateAssignmentExpiry: update,
      revokeAssignment: revoke,
    });
    const trail = auditSpy();
    const service = new AccessControlService(store.implementation, trail);
    for (const expiresAt of [new Date(NOW.getTime() + 1), null]) {
      expect(
        await service.updateAssignmentExpiry(
          assignment.id,
          expiresAt,
          actor(),
          NOW,
        ),
      ).toEqual(assignment);
      expect(update).toHaveBeenLastCalledWith(assignment.id, expiresAt);
      expect(trail.record).toHaveBeenLastCalledWith({
        actorId: "operator",
        targetUserId: assignment.userId,
        detail: expiresAt?.toISOString() ?? "No expiration",
        type: "access.assignment.expiry-updated",
      });
    }
    expect(await service.revokeAssignment(assignment.id, actor(), NOW)).toEqual(
      { revoked: true },
    );
    expect(revoke).toHaveBeenCalledWith(assignment.id, "operator", NOW);
    expect(trail.record).toHaveBeenLastCalledWith({
      actorId: "operator",
      targetUserId: assignment.userId,
      detail: assignment.roleId,
      type: "access.assignment.revoked",
    });
  });

  test("missing or revoked assignments cannot be edited or audited as revoked", async () => {
    for (const rows of [[], [{ ...assignment, revokedAt: NOW }]]) {
      const update = mock<AccessControlRepository["updateAssignmentExpiry"]>(
        async () => null,
      );
      const store = repository({
        listAssignments: async () => rows,
        updateAssignmentExpiry: update,
      });
      const trail = auditSpy();
      const service = new AccessControlService(store.implementation, trail);
      await expect(
        service.updateAssignmentExpiry(assignment.id, null, actor(), NOW),
      ).rejects.toThrow("Assignment not found");
      await expect(
        service.revokeAssignment(assignment.id, actor(), NOW),
      ).rejects.toThrow("Active assignment not found");
      expect(update).not.toHaveBeenCalled();
      expect(trail.record).not.toHaveBeenCalled();
    }
  });
});

test("can delegates the exact permission and scope with the decision time", async () => {
  const effective = mock<AccessControlRepository["hasEffectivePermission"]>(
    async () => false,
  );
  const elevation = mock<AccessControlRepository["hasActiveElevation"]>(
    async () => false,
  );
  const store = repository({
    hasEffectivePermission: effective,
    hasActiveElevation: elevation,
  });
  const trail = auditSpy();
  const service = new AccessControlService(store.implementation, trail);
  const before = Date.now();
  const input = {
    ...actor(),
    userId: "person-1",
    organizationId: "subsidiary-1",
    teamId: "team-1",
    permission: "domain:administer" as const,
  };
  expect(await service.can(input)).toBe(false);
  const decision = effective.mock.calls[0]![0];
  expect(decision).toMatchObject(input);
  expect(decision.at.getTime()).toBeGreaterThanOrEqual(before);
  expect(decision.at.getTime()).toBeLessThanOrEqual(Date.now());
  expect(elevation).toHaveBeenCalledWith(decision);
  expect(trail.record).not.toHaveBeenCalled();
  effective.mockResolvedValue(true);
  expect(await service.can(input)).toBe(true);
  expect(elevation).toHaveBeenCalledTimes(1);
});

test("emergency decisions use the current time through the exact expiry boundary", async () => {
  const expiresAt = new Date(NOW.getTime() + 15 * 60_000);
  const elevation = mock<AccessControlRepository["hasActiveElevation"]>(
    async ({ at }) => at < expiresAt,
  );
  const store = repository({ hasActiveElevation: elevation });
  const trail = auditSpy();
  const service = new AccessControlService(store.implementation, trail);
  const input = {
    ...actor(),
    userId: "operator",
    organizationId: "subsidiary-1",
    teamId: "team-1",
    permission: "domain:administer" as const,
  };
  try {
    for (const [at, allowed] of [
      [new Date(expiresAt.getTime() - 1), true],
      [expiresAt, false],
      [new Date(expiresAt.getTime() + 1), false],
    ] as const) {
      setSystemTime(at);
      expect(await service.can(input)).toBe(allowed);
      expect(elevation).toHaveBeenLastCalledWith({ ...input, at });
    }
    expect(trail.record).toHaveBeenCalledTimes(1);
    expect(trail.record).toHaveBeenCalledWith({
      actorId: "operator",
      detail: "domain:administer on team-1",
      type: "access.break-glass.used",
    });
  } finally {
    setSystemTime();
  }
});

describe("AccessControlService", () => {
  test("only a super-admin can grant a privileged role", async () => {
    const store = repository();
    const service = new AccessControlService(store.implementation, audit);

    await expect(
      service.grantAssignment(
        assignmentInput,
        actor({ identityRole: "admin" }),
        NOW,
      ),
    ).rejects.toThrow("Only a super administrator");
    expect(store.granted).toHaveLength(0);
  });

  test("requires fresh authentication and assignee MFA for a privileged grant", async () => {
    const staleStore = repository();
    const staleService = new AccessControlService(
      staleStore.implementation,
      audit,
    );
    await expect(
      staleService.grantAssignment(
        assignmentInput,
        actor({ sessionCreatedAt: new Date("2026-09-01T11:44:59.000Z") }),
        NOW,
      ),
    ).rejects.toThrow("Sign in again");

    const noMfaStore = repository({ userHasTwoFactor: async () => false });
    const noMfaService = new AccessControlService(
      noMfaStore.implementation,
      audit,
    );
    await expect(
      noMfaService.grantAssignment(assignmentInput, actor(), NOW),
    ).rejects.toThrow("two-factor authentication");
    expect(noMfaStore.granted).toHaveLength(0);
  });

  test("records a valid scoped assignment", async () => {
    const store = repository();
    const service = new AccessControlService(store.implementation, audit);

    await service.grantAssignment(assignmentInput, actor(), NOW);

    expect(store.granted).toHaveLength(1);
    expect(store.granted[0]).toMatchObject({
      organizationId: "subsidiary-1",
      roleId: role.id,
      teamId: "team-1",
      userId: "person-1",
    });
  });

  test("break-glass is super-admin-only and bound to the current session", async () => {
    const store = repository();
    const service = new AccessControlService(store.implementation, audit);
    const input = {
      organizationId: "subsidiary-1",
      permission: "domain:administer",
      reason: "Restore access after an accidental revocation.",
      scope: "team" as const,
      teamId: "team-1",
    };

    await expect(
      service.activateBreakGlass(input, actor({ identityRole: "admin" }), NOW),
    ).rejects.toThrow("Only a super administrator");

    const elevation = await service.activateBreakGlass(input, actor(), NOW);
    expect(store.elevations).toEqual([elevation.id]);
    expect(elevation).toMatchObject({
      sessionId: "session-1",
      userId: "operator",
    });
    expect(elevation.expiresAt.toISOString()).toBe("2026-09-01T12:15:00.000Z");
  });
});

test("a subsidiary grant or elevation cannot authorize a team from another subsidiary", async () => {
  for (const teamOrganizationId of [null, "subsidiary-2"]) {
    const store = repository({
      teamOrganizationId: async () => teamOrganizationId,
      hasEffectivePermission: async () => true,
      hasActiveElevation: async () => true,
    });
    const service = new AccessControlService(store.implementation, audit);
    expect(
      await service.can({
        identityRole: "super-admin",
        organizationId: "subsidiary-1",
        permission: "domain:administer",
        sessionCreatedAt: NOW,
        sessionId: "session-1",
        teamId: "foreign-team",
        userId: "operator",
      }),
    ).toBe(false);
  }
});

test("invalid, future and boundary-old authentication cannot grant privileged access", async () => {
  for (const sessionCreatedAt of [
    new Date("invalid"),
    new Date(NOW.getTime() + 1),
    new Date(NOW.getTime() - 15 * 60_000),
  ]) {
    const store = repository();
    const service = new AccessControlService(store.implementation, audit);
    await expect(
      service.grantAssignment(
        assignmentInput,
        actor({ sessionCreatedAt }),
        NOW,
      ),
    ).rejects.toThrow("Sign in again");
    expect(store.granted).toHaveLength(0);
  }
});

test("valid scopes still require a grant or an audited super-admin elevation", async () => {
  const input = {
    identityRole: "super-admin",
    organizationId: "subsidiary-1",
    permission: "domain:administer" as const,
    sessionCreatedAt: NOW,
    sessionId: "session-1",
    teamId: "team-1",
    userId: "operator",
  };
  const events: string[] = [];
  const trail: AuditTrail = {
    recent: async () => [],
    record: async (event) => {
      events.push(event.type);
    },
  };
  for (const [normal, elevated, identityRole, allowed] of [
    [false, false, "super-admin", false],
    [true, false, "user", true],
    [false, true, "user", false],
    [false, true, "super-admin", true],
  ] as const) {
    const store = repository({
      hasEffectivePermission: async () => normal,
      hasActiveElevation: async () => elevated,
    });
    const service = new AccessControlService(store.implementation, trail);
    expect(await service.can({ ...input, identityRole })).toBe(allowed);
  }
  expect(events).toEqual(["access.break-glass.used"]);
});

test("an impersonated session cannot change access as the person it impersonates", async () => {
  const store = repository();
  const trail = auditSpy();
  const service = new AccessControlService(store.implementation, trail);
  const impersonated = actor({ impersonatedBy: "other-super-admin" });
  const breakGlass = {
    organizationId: "subsidiary-1",
    permission: "domain:administer",
    reason: "Restore access after an accidental revocation.",
    scope: "team" as const,
    teamId: "team-1",
  };
  for (const attempt of [
    () => service.grantAssignment(assignmentInput, impersonated, NOW),
    () => service.activateBreakGlass(breakGlass, impersonated, NOW),
    () => service.createRole(roleInput, impersonated, NOW),
    () => service.updateRole(role.id, roleInput, impersonated, NOW),
    () => service.archiveRole(role.id, impersonated, NOW),
    () =>
      service.updateAssignmentExpiry("assignment-1", null, impersonated, NOW),
    () => service.revokeAssignment("assignment-1", impersonated, NOW),
    () => service.endBreakGlass("elevation-1", impersonated, NOW),
  ])
    await expect(attempt()).rejects.toMatchObject({ status: 403 });
  expect(store.granted).toHaveLength(0);
  expect(store.elevations).toHaveLength(0);
  expect(trail.record).not.toHaveBeenCalled();
});
