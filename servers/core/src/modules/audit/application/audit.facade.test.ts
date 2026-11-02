import { expect, mock, test } from "bun:test";

import { AuditEvent } from "../domain/entities/audit-event.entity";
import { AuditTrailFacade } from "./audit.facade";
import { ListAuditEventsUseCase } from "./use-cases/list-audit-events.use-case";
import { RecordAuditEventUseCase } from "./use-cases/record-audit-event.use-case";

test("record persists the caller's fact with a generated ID and database-owned timestamp", async () => {
  const append = mock(async (_event: AuditEvent) => {});
  const repository = { append, listNewestFirst: async () => [] };
  const facade = new AuditTrailFacade(
    new RecordAuditEventUseCase(repository),
    new ListAuditEventsUseCase(repository),
  );

  expect(
    await facade.record({
      actorId: "operator",
      type: " account.retired ",
      targetUserId: "user",
      detail: "Left",
    }),
  ).toBeUndefined();
  expect(append).toHaveBeenCalledTimes(1);
  const event = append.mock.calls[0]![0];
  expect(event.id).toMatch(/^[0-9a-f-]{36}$/);
  expect(event.type).toBe("account.retired");
  expect(event.actorId).toBe("operator");
  expect(event.targetUserId).toBe("user");
  expect(event.detail).toBe("Left");
  expect(event.createdAt).toBeNull();
});

test("record waits for persistence and propagates its failure", async () => {
  const pending = Promise.withResolvers<void>();
  const repository = {
    append: () => pending.promise,
    listNewestFirst: async () => [],
  };
  const facade = new AuditTrailFacade(
    new RecordAuditEventUseCase(repository),
    new ListAuditEventsUseCase(repository),
  );
  let completed = false;
  const result = facade.record({ actorId: null, type: "system.act" });
  void result.then(
    () => {
      completed = true;
    },
    () => {},
  );
  await Promise.resolve();
  expect(completed).toBe(false);
  pending.reject(new Error("database unavailable"));
  await expect(result).rejects.toThrow("database unavailable");
});

test("recent returns plain event data in repository order", async () => {
  const createdAt = new Date("2026-10-26T12:00:00Z");
  const event = AuditEvent.restore({
    id: "event",
    actorId: null,
    targetUserId: "user",
    type: "account.issued",
    detail: null,
    createdAt,
  });
  const repository = {
    append: async () => {},
    listNewestFirst: async () => [event],
  };
  const facade = new AuditTrailFacade(
    new RecordAuditEventUseCase(repository),
    new ListAuditEventsUseCase(repository),
  );
  const rows = await facade.recent(10);
  expect(rows).toEqual([
    {
      id: "event",
      actorId: null,
      targetUserId: "user",
      type: "account.issued",
      detail: null,
      createdAt,
    },
  ]);
  expect(rows[0]).not.toBeInstanceOf(AuditEvent);
});

test("an unstamped event has the epoch fallback and nullable fields", async () => {
  const event = AuditEvent.record({ actorId: null, type: "system.act" });
  const repository = {
    append: async () => {},
    listNewestFirst: async () => [event],
  };
  const facade = new AuditTrailFacade(
    new RecordAuditEventUseCase(repository),
    new ListAuditEventsUseCase(repository),
  );
  expect(await facade.recent(1)).toEqual([
    {
      id: event.id,
      actorId: null,
      targetUserId: null,
      type: "system.act",
      detail: null,
      createdAt: new Date(0),
    },
  ]);
});

test("record refuses an empty event type without persisting it", async () => {
  const append = mock(async (_event: AuditEvent) => {});
  const repository = { append, listNewestFirst: async () => [] };
  const facade = new AuditTrailFacade(
    new RecordAuditEventUseCase(repository),
    new ListAuditEventsUseCase(repository),
  );
  await expect(facade.record({ actorId: null, type: "  " })).rejects.toThrow(
    "An audit event needs a type",
  );
  expect(append).not.toHaveBeenCalled();
});
