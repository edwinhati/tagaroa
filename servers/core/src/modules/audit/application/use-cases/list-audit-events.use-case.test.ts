import { expect, mock, test } from "bun:test";

import { AuditEvent } from "../../domain/entities/audit-event.entity";
import { ListAuditEventsUseCase } from "./list-audit-events.use-case";

test("list forwards the limit and preserves newest-first repository results", async () => {
  const events = [
    AuditEvent.record({ actorId: null, type: "newer" }),
    AuditEvent.record({ actorId: null, type: "older" }),
  ];
  const listNewestFirst = mock(async (_limit: number) => events);
  const useCase = new ListAuditEventsUseCase({
    append: async () => {},
    listNewestFirst,
  });
  expect(await useCase.execute(2)).toBe(events);
  expect(listNewestFirst).toHaveBeenCalledWith(2);
});

test("list returns an empty trail and propagates read failures", async () => {
  const repository = {
    append: async () => {},
    listNewestFirst: mock(async (): Promise<AuditEvent[]> => []),
  };
  const useCase = new ListAuditEventsUseCase(repository);
  expect(await useCase.execute(10)).toEqual([]);
  repository.listNewestFirst.mockRejectedValueOnce(new Error("read failed"));
  await expect(useCase.execute(10)).rejects.toThrow("read failed");
});
