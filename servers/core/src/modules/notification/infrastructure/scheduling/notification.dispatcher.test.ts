import { expect, mock, test } from "bun:test";

import type { DispatchOptions } from "../../application/notification.options";
import type { DrainQueueUseCase } from "../../application/use-cases/drain-queue.use-case";
import { NotificationDispatcher } from "./notification.dispatcher";

const setup = () => {
  const drainQueue = { execute: mock(async () => {}) };
  const dispatcher = new NotificationDispatcher(
    drainQueue as unknown as DrainQueueUseCase,
    {
      batchSize: 20,
      maxAttempts: 5,
      pollMilliseconds: 2000,
      worker: true,
    } satisfies DispatchOptions,
  );
  return { dispatcher, drainQueue };
};

test("overlapping passes are skipped and the next one runs after completion", async () => {
  const { dispatcher, drainQueue } = setup();
  const pass = Promise.withResolvers<void>();
  drainQueue.execute.mockReturnValueOnce(pass.promise);
  const first = dispatcher.tick();
  await dispatcher.tick();
  expect(drainQueue.execute).toHaveBeenCalledTimes(1);
  pass.resolve();
  await first;
  await dispatcher.tick();
  expect(drainQueue.execute).toHaveBeenCalledTimes(2);
});

test("a failed pass is contained and does not wedge later ones", async () => {
  const { dispatcher, drainQueue } = setup();
  drainQueue.execute.mockRejectedValueOnce(new Error("provider down"));
  await expect(dispatcher.tick()).resolves.toBeUndefined();
  await dispatcher.tick();
  expect(drainQueue.execute).toHaveBeenCalledTimes(2);
});

// The pool closes in `onApplicationShutdown`, after this hook settles. A pass
// still sending when it closes cannot mark its messages sent, and they go out
// a second time when their claims are reclaimed.
test("shutdown waits for a pass already sending", async () => {
  const { dispatcher, drainQueue } = setup();
  const pass = Promise.withResolvers<void>();
  drainQueue.execute.mockReturnValueOnce(pass.promise);
  void dispatcher.tick();

  let stopped = false;
  const shutdown = dispatcher.onModuleDestroy().then(() => {
    stopped = true;
  });
  await Bun.sleep(0);
  expect(stopped).toBe(false);

  pass.resolve();
  await shutdown;
  expect(stopped).toBe(true);
});

test("shutdown with no pass under way returns at once", async () => {
  const { dispatcher } = setup();
  await expect(dispatcher.onModuleDestroy()).resolves.toBeUndefined();
});
