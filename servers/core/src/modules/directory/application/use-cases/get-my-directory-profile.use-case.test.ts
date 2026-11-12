import { expect, test } from "bun:test";

import { type PositionRecord } from "@repo/contracts/directory";

import { Subsidiary, Team } from "../../domain/entities/subsidiary.entity";
import { type PersonRepository } from "../../domain/repositories/person.repository";
import { type PositionRepository } from "../../domain/repositories/position.repository";
import { type SubsidiaryRepository } from "../../domain/repositories/subsidiary.repository";
import { GetMyDirectoryProfileUseCase } from "./get-my-directory-profile.use-case";

const position = (
  overrides: Partial<PositionRecord> & Pick<PositionRecord, "id" | "title">,
): PositionRecord => ({
  managerUserId: null,
  organizationId: null,
  updatedAt: new Date("2026-01-01T00:00:00Z"),
  updatedBy: null,
  userId: "person-1",
  ...overrides,
});

test("returns the signed-in person's subsidiaries, teams and titles", async () => {
  const positions: PositionRepository = {
    list: async () => [],
    listForUser: async (userId) =>
      userId === "person-1"
        ? [
            position({
              id: "pos-group",
              managerUserId: "manager-1",
              title: "Group counsel",
            }),
            position({
              id: "pos-sub",
              managerUserId: null,
              organizationId: "org-1",
              title: "Subsidiary lead",
            }),
          ]
        : [],
    remove: async () => false,
    save: async () => {
      throw new Error("unused");
    },
  };
  const people: PersonRepository = {
    countLinkedAccounts: async () => 0,
    displayNamesOf: async (ids) =>
      new Map(ids.includes("manager-1") ? [["manager-1", "Ada Manager"]] : []),
    linkedAccountsOf: async () => [],
    listAll: async () => [],
    personalEmailOf: async () => null,
  };
  const subsidiaries: SubsidiaryRepository = {
    countSubsidiaries: async () => 2,
    listSubsidiaries: async () => [
      Subsidiary.restore({
        id: "org-1",
        name: "Tagaroa Shipping",
        slug: "shipping",
      }),
      Subsidiary.restore({
        id: "org-2",
        name: "Tagaroa Energy",
        slug: "energy",
      }),
    ],
    listTeams: async () => [
      Team.restore({
        id: "team-eng",
        memberIds: ["person-1", "other"],
        name: "Engineering",
        organizationId: "org-1",
      }),
      Team.restore({
        id: "team-ops",
        memberIds: ["other"],
        name: "Operations",
        organizationId: "org-2",
      }),
    ],
    memberIdsBySubsidiary: async () =>
      new Map([
        ["org-1", ["person-1"]],
        ["org-2", ["other"]],
      ]),
    membershipUserIds: async () => new Set(["person-1", "other"]),
  };

  const result = await new GetMyDirectoryProfileUseCase(
    positions,
    people,
    subsidiaries,
  ).execute("person-1");

  expect(result.subsidiaries).toEqual([
    { id: "org-1", name: "Tagaroa Shipping" },
  ]);
  expect(result.teams).toEqual([
    {
      id: "team-eng",
      name: "Engineering",
      subsidiaryName: "Tagaroa Shipping",
    },
  ]);
  expect(result.positions).toEqual([
    {
      id: "pos-group",
      managerName: "Ada Manager",
      subsidiaryName: null,
      title: "Group counsel",
    },
    {
      id: "pos-sub",
      managerName: null,
      subsidiaryName: "Tagaroa Shipping",
      title: "Subsidiary lead",
    },
  ]);
});
