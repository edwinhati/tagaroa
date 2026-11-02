import { expect, mock, test } from "bun:test";

import type { AuditTrail } from "../../audit/application/audit.facade";
import type { AccessControlRepository } from "../domain/repositories/access-control.repository";
import type { DomainAccessRepository } from "../domain/repositories/domain-access.repository";
import {
  AccessControlService,
  type AccessActor,
} from "./access-control.service";
import { DomainAccessService } from "./domain-access.service";

const actor = (): AccessActor => ({
  id: "operator",
  identityRole: "super-admin",
  sessionId: "session-1",
  sessionCreatedAt: new Date(),
});

const fixture = (parent: string | null = "subsidiary-1") => {
  const bindings = new Map<string, string>();
  const bind = mock<DomainAccessRepository["bind"]>(async (teamId, slug) => {
    if (slug === null) bindings.delete(teamId);
    else bindings.set(teamId, slug);
  });
  const domains: DomainAccessRepository = {
    bind,
    list: async () =>
      [...bindings].map(([teamId, domainSlug]) => ({ teamId, domainSlug })),
    mine: async () =>
      [...bindings].map(([teamId, domainSlug]) => ({
        teamId,
        domainSlug,
        organizationId: "subsidiary-1",
      })),
  };
  const record = mock<AuditTrail["record"]>(async () => undefined);
  const repository: AccessControlRepository = {
    activeElevations: async () => [],
    archiveRole: async () => false,
    createRole: async () => undefined,
    endElevation: async () => false,
    findActiveAssignment: async () => null,
    findRole: async () => null,
    grantAssignment: async () => undefined,
    grantElevation: async () => undefined,
    hasActiveElevation: async () => false,
    hasEffectivePermission: async () => false,
    isOrganizationMember: async () => false,
    isTeamMember: async () => false,
    listAssignments: async () => [],
    listRoles: async () => [],
    organizationExists: async () => false,
    revokeAssignment: async () => null,
    roleHasActiveAssignments: async () => false,
    roleKeyOrNameExists: async () => false,
    teamOrganizationId: async () => parent,
    updateAssignmentExpiry: async () => null,
    updateRole: async () => false,
    userHasTwoFactor: async () => false,
  };
  const access = new AccessControlService(repository, {
    record,
    recent: async () => [],
  });
  const service = new DomainAccessService(domains, repository, access, {
    record,
    recent: async () => [],
  });
  return { service, bind, record, access };
};

test("admission uses explicit bindings even when a team's name suggests another domain", async () => {
  const { service, bind, record } = fixture();
  const operator = actor();
  expect(await service.list()).toEqual([]);
  expect(await service.mine(operator)).toEqual([]);
  expect(await service.bind("engineering", "finance", operator)).toEqual({
    teamId: "engineering",
    domainSlug: "finance",
  });
  expect(await service.list()).toEqual([
    { teamId: "engineering", domainSlug: "finance" },
  ]);
  expect(bind).toHaveBeenCalledWith("engineering", "finance");
  expect(record).toHaveBeenLastCalledWith({
    actorId: operator.id,
    type: "access.team-domain.changed",
    detail: "engineering: finance",
  });
  await service.bind("engineering", "research", operator);
  expect(await service.list()).toEqual([
    { teamId: "engineering", domainSlug: "research" },
  ]);
  await service.bind("engineering", null, operator);
  expect(await service.list()).toEqual([]);
  expect(await service.mine(operator)).toEqual([]);
  expect(record).toHaveBeenLastCalledWith({
    actorId: operator.id,
    type: "access.team-domain.changed",
    detail: "engineering: none",
  });
});

test("invalid domains, missing teams and stale authentication cannot change bindings", async () => {
  for (const slug of ["unknown", "Engineering", "", undefined, 1, {}]) {
    const { service, bind, record } = fixture();
    await expect(service.bind("team-1", slug, actor())).rejects.toThrow(
      "known domain",
    );
    expect(bind).not.toHaveBeenCalled();
    expect(record).not.toHaveBeenCalled();
  }
  const missing = fixture(null);
  await expect(
    missing.service.bind("missing", "engineering", actor()),
  ).rejects.toThrow("Team not found");
  expect(missing.bind).not.toHaveBeenCalled();
  expect(missing.record).not.toHaveBeenCalled();
  const stale = fixture();
  await expect(
    stale.service.bind("team-1", "engineering", {
      ...actor(),
      sessionCreatedAt: new Date(0),
    }),
  ).rejects.toThrow("Sign in again");
  expect(stale.bind).not.toHaveBeenCalled();
  expect(stale.record).not.toHaveBeenCalled();
});

test("mine derives administration for each bound team and current actor", async () => {
  const { service, access } = fixture();
  const operator = actor();
  await service.bind("team-1", "engineering", operator);
  await service.bind("team-2", "finance", operator);
  const can = mock<AccessControlService["can"]>(
    async (input) => input.teamId === "team-1",
  );
  access.can = can;
  expect(await service.mine(operator)).toEqual([
    {
      teamId: "team-1",
      organizationId: "subsidiary-1",
      domainSlug: "engineering",
      administered: true,
    },
    {
      teamId: "team-2",
      organizationId: "subsidiary-1",
      domainSlug: "finance",
      administered: false,
    },
  ]);
  for (const teamId of ["team-1", "team-2"]) {
    expect(can).toHaveBeenCalledWith({
      userId: operator.id,
      identityRole: operator.identityRole,
      sessionId: operator.sessionId,
      sessionCreatedAt: operator.sessionCreatedAt,
      organizationId: "subsidiary-1",
      teamId,
      permission: "domain:administer",
    });
  }
});
