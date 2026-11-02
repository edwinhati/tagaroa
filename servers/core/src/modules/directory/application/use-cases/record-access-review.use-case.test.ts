import { expect, test } from "bun:test";

import type { AuditTrail } from "../../../audit/application/audit.facade";
import { person } from "../../domain/entities/person.fixture";
import type { PersonRepository } from "../../domain/repositories/person.repository";
import { RecordAccessReviewUseCase } from "./record-access-review.use-case";

test("only independent reviews of active privileged accounts are persisted and audited", async () => {
  const saved: string[] = [];
  const events: string[] = [];
  const people: PersonRepository = {
    listAll: async () => [
      person({ id: "admin", role: "admin" }),
      person({ id: "employee" }),
      person({ id: "suspended", role: "admin", banned: true }),
    ],
    countLinkedAccounts: async () => 0,
    displayNamesOf: async () => new Map(),
    linkedAccountsOf: async () => [],
    personalEmailOf: async () => null,
  };
  const audit: AuditTrail = {
    recent: async () => [],
    record: async (event) => {
      events.push(event.type);
    },
  };
  const useCase = new RecordAccessReviewUseCase(
    {
      listAll: async () => [],
      record: async (id) => {
        saved.push(id);
      },
    },
    audit,
    people,
  );
  await expect(useCase.execute("admin", { id: "admin" })).rejects.toThrow(
    "Another operator",
  );
  await expect(useCase.execute("missing", { id: "reviewer" })).rejects.toThrow(
    "Person not found",
  );
  for (const id of ["employee", "suspended"]) {
    await expect(useCase.execute(id, { id: "reviewer" })).rejects.toThrow(
      "Only active privileged",
    );
  }
  await expect(
    useCase.execute("admin", { id: "reviewer", impersonatedBy: "admin" }),
  ).rejects.toThrow("your own");
  expect(saved).toEqual([]);
  expect(events).toEqual([]);
  await useCase.execute("admin", { id: "reviewer" });
  expect(saved).toEqual(["admin"]);
  expect(events).toEqual(["user.privileged-access.reviewed"]);
});
