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

const recordingAudit = () => {
  const events: Parameters<AuditTrail["record"]>[0][] = [];
  const trail: AuditTrail = {
    recent: async () => [],
    record: async (event) => {
      events.push(event);
    },
  };
  return { events, trail };
};

const audit = recordingAudit().trail;

const reportsTo = (
  userId: string,
  managerUserId: string | null,
  organizationId: string | null = "subsidiary-1",
): PositionRecord => ({
  id: `position-${userId}`,
  managerUserId,
  organizationId,
  title: "Engineer",
  updatedAt: new Date("2026-09-01T12:00:00.000Z"),
  updatedBy: "operator",
  userId,
});

const draft = (
  userId: string,
  managerUserId: string | null,
  organizationId: string | null = "subsidiary-1",
) => ({
  actorId: "operator",
  managerUserId,
  organizationId,
  title: "Engineer",
  userId,
});

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
      title: "Staff engineer",
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

  test("rejects a cycle longer than two people", async () => {
    // linus → ada → grace; grace reporting to linus closes the loop.
    const useCase = new ManagePositionUseCase(
      positions([reportsTo("linus", "ada"), reportsTo("ada", "grace")]),
      people,
      subsidiaries(),
      audit,
    );

    await expect(useCase.save(draft("grace", "linus"))).rejects.toThrow(
      "create a cycle",
    );
  });

  test("accepts a valid chain and records the change", async () => {
    const { events, trail } = recordingAudit();
    const useCase = new ManagePositionUseCase(
      positions([reportsTo("ada", "grace")]),
      people,
      subsidiaries(),
      trail,
    );

    // grace reporting to linus extends ada → grace → linus without a loop.
    await expect(useCase.save(draft("grace", "linus"))).resolves.toMatchObject({
      managerUserId: "linus",
      userId: "grace",
    });
    expect(events).toEqual([
      {
        actorId: "operator",
        detail: "subsidiary-1: Engineer",
        targetUserId: "grace",
        type: "directory.position.updated",
      },
    ]);
  });

  test("only counts reporting lines in the same scope towards a cycle", async () => {
    const useCase = new ManagePositionUseCase(
      positions([reportsTo("ada", "grace", null)]),
      people,
      subsidiaries(),
      audit,
    );

    // ada → grace holds at group scope; grace → ada in a subsidiary is fine.
    await expect(useCase.save(draft("grace", "ada"))).resolves.toMatchObject({
      managerUserId: "ada",
    });
  });

  test("rejects a person or manager who does not exist", async () => {
    const useCase = new ManagePositionUseCase(
      positions(),
      people,
      subsidiaries(),
      audit,
    );

    await expect(useCase.save(draft("nobody", "grace"))).rejects.toThrow(
      "Person not found",
    );
    await expect(useCase.save(draft("ada", "nobody"))).rejects.toThrow(
      "Manager not found",
    );
  });

  test("rejects a person outside the position's subsidiary", async () => {
    const useCase = new ManagePositionUseCase(
      positions(),
      people,
      subsidiaries(["grace"]),
      audit,
    );

    await expect(useCase.save(draft("ada", "grace"))).rejects.toThrow(
      "must belong to this subsidiary",
    );
    await expect(useCase.save(draft("ada", null))).rejects.toThrow(
      "must belong to this subsidiary",
    );
  });

  test("checks no membership for a group-scoped position", async () => {
    const useCase = new ManagePositionUseCase(
      positions(),
      people,
      subsidiaries([]),
      audit,
    );

    await expect(
      useCase.save(draft("ada", "grace", null)),
    ).resolves.toMatchObject({ organizationId: null });
  });

  test("removes a position, leaves its reports' lines alone, and audits it", async () => {
    const repository = positions([
      reportsTo("grace", "linus"),
      reportsTo("ada", "grace"),
    ]);
    const { events, trail } = recordingAudit();
    const useCase = new ManagePositionUseCase(
      repository,
      people,
      subsidiaries(),
      trail,
    );

    await expect(
      useCase.remove({
        actorId: "operator",
        organizationId: "subsidiary-1",
        userId: "grace",
      }),
    ).resolves.toEqual({ removed: true });

    // A manager is a person, not a position: ada still reports to grace.
    expect(await repository.list()).toEqual([reportsTo("ada", "grace")]);
    expect(events).toEqual([
      {
        actorId: "operator",
        detail: "subsidiary-1",
        targetUserId: "grace",
        type: "directory.position.removed",
      },
    ]);
  });

  test("refuses to remove a position that does not exist, unaudited", async () => {
    const { events, trail } = recordingAudit();
    const useCase = new ManagePositionUseCase(
      positions([reportsTo("ada", "grace")]),
      people,
      subsidiaries(),
      trail,
    );

    await expect(
      useCase.remove({
        actorId: "operator",
        organizationId: null,
        userId: "ada",
      }),
    ).rejects.toThrow("Position not found");
    expect(events).toEqual([]);
  });
});
