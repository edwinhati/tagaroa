import { expect, mock, spyOn, test } from "bun:test";

import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";

import type { Database } from "../../../../platform/database/database.module";
import type { ReconcileEmployeesUseCase } from "../../application/use-cases/reconcile-employees.use-case";
import type { HrOptions } from "../config/hr.options";
import { HrReconciler, RECONCILE_LOCK } from "./hr.reconciler";

const setup = (
  rows: { locked: boolean }[] = [{ locked: true }],
  options: HrOptions = null,
) => {
  const execute = mock(async (_query: SQL) => rows);
  const transaction = mock(
    async (run: (tx: { execute: typeof execute }) => Promise<void>) =>
      run({ execute }),
  );
  const reconcile = { execute: mock(async () => {}) };
  const worker = new HrReconciler(
    reconcile as unknown as ReconcileEmployeesUseCase,
    { transaction } as unknown as Database,
    options,
  );
  return { worker, execute, transaction, reconcile };
};

test("tick takes the transaction-scoped advisory lock before reconciling", async () => {
  const { worker, execute, transaction, reconcile } = setup();
  await worker.tick();
  expect(transaction).toHaveBeenCalledTimes(1);
  const query = new PgDialect().sqlToQuery(execute.mock.calls[0]![0]);
  expect(query.params).toEqual([RECONCILE_LOCK]);
  expect(reconcile.execute).toHaveBeenCalledTimes(1);
});

test.each([false, undefined])(
  "tick skips reconciliation when lock result is %j",
  async (locked) => {
    const { worker, reconcile } = setup(
      locked === undefined ? [] : [{ locked }],
    );
    await worker.tick();
    expect(reconcile.execute).not.toHaveBeenCalled();
  },
);

test("overlapping ticks are skipped and the next tick runs after completion", async () => {
  const { worker, transaction, reconcile } = setup();
  const pass = Promise.withResolvers<void>();
  reconcile.execute.mockReturnValueOnce(pass.promise);
  const first = worker.tick();
  await worker.tick();
  expect(transaction).toHaveBeenCalledTimes(1);
  pass.resolve();
  await first;
  await worker.tick();
  expect(reconcile.execute).toHaveBeenCalledTimes(2);
});

test("a failed reconciliation is contained and does not wedge later ticks", async () => {
  const { worker, reconcile } = setup();
  reconcile.execute.mockRejectedValueOnce(new Error("Frappe unavailable"));
  await expect(worker.tick()).resolves.toBeUndefined();
  await worker.tick();
  expect(reconcile.execute).toHaveBeenCalledTimes(2);
});

test("a transaction failure does not wedge later ticks", async () => {
  const { worker, transaction, reconcile } = setup();
  transaction.mockRejectedValueOnce(new Error("database unavailable"));
  await expect(worker.tick()).resolves.toBeUndefined();
  await worker.tick();
  expect(transaction).toHaveBeenCalledTimes(2);
  expect(reconcile.execute).toHaveBeenCalledTimes(1);
});

test("unconfigured HR does not start a reconciliation", async () => {
  const { worker, transaction } = setup();
  worker.onApplicationBootstrap();
  await worker.onModuleDestroy();
  expect(transaction).not.toHaveBeenCalled();
});

test("shutdown waits for a reconciliation already under way", async () => {
  const { worker, reconcile } = setup();
  const pass = Promise.withResolvers<void>();
  reconcile.execute.mockReturnValueOnce(pass.promise);
  void worker.tick();

  let stopped = false;
  const shutdown = worker.onModuleDestroy().then(() => {
    stopped = true;
  });
  await Bun.sleep(0);
  expect(stopped).toBe(false);

  pass.resolve();
  await shutdown;
  expect(stopped).toBe(true);
});

test("configured HR ticks at startup and hourly, and clears its timer at shutdown", async () => {
  const { worker } = setup([{ locked: true }], {
    url: "https://hr.example.test",
    apiKey: "key",
    apiSecret: "secret",
    webhookSecret: "webhook",
  });
  const tick = spyOn(worker, "tick").mockResolvedValue(undefined);
  const interval = spyOn(globalThis, "setInterval");
  const clear = spyOn(globalThis, "clearInterval");
  try {
    worker.onApplicationBootstrap();
    expect(tick).toHaveBeenCalledTimes(1);
    expect(interval).toHaveBeenCalledTimes(1);
    expect(interval.mock.calls[0]![1]).toBe(60 * 60_000);
    const callback = interval.mock.calls[0]![0] as () => void;
    callback();
    expect(tick).toHaveBeenCalledTimes(2);
    await worker.onModuleDestroy();
    expect(clear).toHaveBeenCalledWith(interval.mock.results[0]!.value);
  } finally {
    await worker.onModuleDestroy();
    interval.mockRestore();
    clear.mockRestore();
    tick.mockRestore();
  }
});

test("idle resolves once the pass under way has finished", async () => {
  const { worker, reconcile } = setup();
  const pass = Promise.withResolvers<void>();
  reconcile.execute.mockReturnValueOnce(pass.promise);
  void worker.tick();

  let settled = false;
  const idle = worker.idle().then(() => {
    settled = true;
  });
  await Bun.sleep(0);
  expect(settled).toBe(false);

  pass.resolve();
  await idle;
  expect(settled).toBe(true);
  await expect(worker.idle()).resolves.toBeUndefined();
});
