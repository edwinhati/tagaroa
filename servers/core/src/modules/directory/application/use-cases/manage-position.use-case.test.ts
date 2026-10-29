import { describe, expect, test } from "bun:test";

import type { AuditTrail } from "../../../audit/application/audit.facade";
import { person } from "../../domain/entities/person.fixture";
import type { PersonRepository } from "../../domain/repositories/person.repository";
import type {
  PositionRecord,
  PositionRepository,
} from "../../domain/repositories/position.repository";
import type { SubsidiaryRepository } from "../../domain/repositories/subsidiary.repository";
import { ManagePositionUseCase } from "./manage-position.use-case";

const people: PersonRepository = {
  countLinkedAccounts: async () => 0,
  displayNamesOf: async () => new Map(),
  linkedAccountsOf: async () => [],
  listAll: async () => [
    person({ id: "ada", name: "Ada" }),
    person({ id: "grace", name: "Grace" }),
    person({ id: "linus", name: "Linus" }),
  ],
  personalEmailOf: async () => null,
};

const subsidiaries = (
  members = ["ada", "grace", "linus"],
): SubsidiaryRepository => ({
  countSubsidiaries: async () => 1,
  listSubsidiaries: async () => [],
  listTeams: async () => [],
  memberIdsBySubsidiary: async () => new Map([["subsidiary-1", members]]),
  membershipUserIds: async () => new Set(members),
});

const positions = (initial: PositionRecord[] = []) => {
  const rows = [...initial];
  const repository: PositionRepository = {
    find: async (userId, organizationId) =>
      rows.find(
        (row) => row.userId === userId && row.organizationId === organizationId,
      ) ?? null,
    list: async () => rows,
    listForUser: async (userId) => rows.filter((row) => row.userId === userId),
    remove: async (userId, organizationId) => {
      const index = rows.findIndex(
        (row) => row.userId === userId && row.organizationId === organizationId,
      );
      if (index < 0) return false;
      rows.splice(index, 1);
      return true;
    },
    save: async (input) => {
      const row = {
        id: input.id,
        managerUserId: input.managerUserId,
        organizationId: input.organizationId,
        title: input.title,
        updatedAt: new Date("2026-09-01T12:00:00.000Z"),
        updatedBy: input.actorId,
        userId: input.userId,
      };
      rows.push(row);
      return row;
    },
  };
  return repository;
};

const audit: AuditTrail = {
  recent: async () => [],
  record: async () => undefined,
};

describe("ManagePositionUseCase", () => {
  test("rejects self-reporting and reporting cycles", async () => {
    const repository = positions([
      {
        id: "position-1",
        managerUserId: "grace",
        organizationId: "subsidiary-1",
        title: "Engineer",
        updatedAt: new Date("2026-09-01T12:00:00.000Z"),
        updatedBy: "operator",
        userId: "ada",
      },
    ]);
    const useCase = new ManagePositionUseCase(
      repository,
      people,
      subsidiaries(),
      audit,
    );

    await expect(
      useCase.save({
        actorId: "operator",
        managerUserId: "grace",
        organizationId: "subsidiary-1",
        title: "Manager",
        userId: "grace",
      }),
    ).rejects.toThrow("cannot report to themselves");

    await expect(
      useCase.save({
        actorId: "operator",
        managerUserId: "ada",
        organizationId: "subsidiary-1",
        title: "Manager",
        userId: "grace",
      }),
    ).rejects.toThrow("create a cycle");
  });

  test("requires both people to belong to a subsidiary-scoped position", async () => {
    const useCase = new ManagePositionUseCase(
      positions(),
      people,
      subsidiaries(["ada"]),
      audit,
    );

    await expect(
      useCase.save({
        actorId: "operator",
        managerUserId: "grace",
        organizationId: "subsidiary-1",
        title: "Engineer",
        userId: "ada",
      }),
    ).rejects.toThrow("must belong to this subsidiary");
  });

  test("keeps a position descriptive and stores no permission data", async () => {
    const repository = positions();
    const useCase = new ManagePositionUseCase(
      repository,
      people,
      subsidiaries(),
      audit,
    );

    const saved = await useCase.save({
      actorId: "operator",
      managerUserId: "grace",
      organizationId: null,
      title: "  Staff engineer  ",
      userId: "ada",
    });

    expect(saved).toMatchObject({
      managerUserId: "grace",
      organizationId: null,
      title: "Staff engineer",
      userId: "ada",
    });
    expect(Object.keys(saved)).not.toContain("permissions");
  });
});
