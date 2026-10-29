import { describe, expect, test } from "bun:test";

import type { AuditTrail } from "../../audit/application/audit.facade";
import type {
  AccessAssignmentRecord,
  AccessControlRepository,
  AccessRoleRecord,
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
