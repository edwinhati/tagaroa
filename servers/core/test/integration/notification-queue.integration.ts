import {
  afterAll,
  beforeAll,
  expect,
  setDefaultTimeout,
  spyOn,
  test,
} from "bun:test";

import { Logger } from "@nestjs/common";
import { SQL } from "bun";
import { eq, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/bun-sql";

import { DrainQueueUseCase } from "../../src/modules/notification/application/use-cases/drain-queue.use-case";
import { Message } from "../../src/modules/notification/domain/entities/message.entity";
import { Suppression } from "../../src/modules/notification/domain/entities/suppression.entity";
import { ChannelError } from "../../src/modules/notification/domain/errors/channel.error";
import { DrizzleMessageRepository } from "../../src/modules/notification/infrastructure/persistence/drizzle/drizzle-message.repository";
import { DrizzleSuppressionRepository } from "../../src/modules/notification/infrastructure/persistence/drizzle/drizzle-suppression.repository";
import { notificationMessage } from "../../src/modules/notification/infrastructure/persistence/drizzle/schema";
import { NotificationDispatcher } from "../../src/modules/notification/infrastructure/scheduling/notification.dispatcher";
import type { Database } from "../../src/platform/database/database.module";
import { prepareTestDatabase, testEnv } from "../database";

setDefaultTimeout(60_000);
let client: SQL;
let db: Database;
beforeAll(async () => {
  await prepareTestDatabase();
  client = new SQL(testEnv.DATABASE_URL);
  db = drizzle({ client });
});
afterAll(async () => {
  await client?.close();
});

test("two concurrent queue workers send each of 200 due messages once", async () => {
  const [earlier] =
    await client`select count(*)::int as count from notification.message where status = 'pending' and next_attempt_at <= timestamp '1970-01-01'`;
  expect(earlier.count).toBe(0);
  const messages = new DrizzleMessageRepository(db);
  const suppressions = new DrizzleSuppressionRepository(db);
  const fixtures = Array.from({ length: 200 }, () => message());
  const ids = fixtures.map((item) => item.id);
  const owned = new Set(ids);
  const sent = new Set<string>();
  try {
    await Promise.all(fixtures.map((item) => messages.enqueue(item)));
    await db
      .update(notificationMessage)
      .set({ nextAttemptAt: new Date(0) })
      .where(inArray(notificationMessage.id, ids));
    const carrier = {
      async send(outgoing: { id: string }) {
        expect(owned.has(outgoing.id)).toBe(true);
        expect(sent.has(outgoing.id)).toBe(false);
        sent.add(outgoing.id);
        return { providerId: outgoing.id };
      },
    };
    const workers = Array.from(
      { length: 2 },
      () =>
        new DrainQueueUseCase(messages, suppressions, carrier, {
          ...options,
          batchSize: 100,
        }),
    );
    await Promise.all(workers.map((worker) => worker.execute()));
    expect(sent.size).toBe(200);
    const rows = await db
      .select()
      .from(notificationMessage)
      .where(inArray(notificationMessage.id, ids));
    expect(
      rows.every((row) => row.status === "sent" && row.attempts === 1),
    ).toBe(true);
  } finally {
    await db
      .delete(notificationMessage)
      .where(inArray(notificationMessage.id, ids));
  }
});

// Queue claims run against an empty transactional view; rollback preserves all other fixtures.
async function isolated(run: (database: Database) => Promise<void>) {
  const rollback = new Error("rollback queue fixture");
  try {
    await db.transaction(async (transaction) => {
      const database = transaction as unknown as Database;
      await database.delete(notificationMessage);
      await run(database);
      throw rollback;
    });
  } catch (error) {
    if (error !== rollback) throw error;
  }
}

const message = (over: Partial<Parameters<typeof Message.enqueue>[0]> = {}) =>
  Message.enqueue({
    channel: "email",
    destination: `qa-${crypto.randomUUID()}@tagaroa.test`,
    key: "qa.queue",
    locale: "en",
    payload: { body: "Credential {{password}}", subject: "QA", variables: [] },
    secrets: { password: "fixture-only" },
    templateId: null,
    idempotencyKey: null,
    suppressedReason: null,
    ...over,
  });
const options = {
  batchSize: 25,
  maxAttempts: 3,
  pollMilliseconds: 1000,
  worker: false,
};

test("queue retries transient failure only when due and clears secrets after success", () =>
  isolated(async (database) => {
    const messages = new DrizzleMessageRepository(database);
    const suppressions = new DrizzleSuppressionRepository(database);
    const queued = message();
    await messages.enqueue(queued);
    await database
      .update(notificationMessage)
      .set({ nextAttemptAt: new Date(0) })
      .where(eq(notificationMessage.id, queued.id));
    let calls = 0;
    const drain = new DrainQueueUseCase(
      messages,
      suppressions,
      {
        async send(outgoing) {
          calls += 1;
          expect(outgoing.payload.body).toBe("Credential fixture-only");
          if (calls === 1)
            throw new ChannelError("temporary fixture failure", false);
          return { providerId: "qa-provider" };
        },
      },
      options,
    );
    await drain.execute();
    let [row] = await database
      .select()
      .from(notificationMessage)
      .where(eq(notificationMessage.id, queued.id));
    expect(row?.status).toBe("pending");
    expect(row?.attempts).toBe(1);
    expect(row?.secrets).toEqual({ password: "fixture-only" });
    expect(row!.nextAttemptAt.getTime()).toBeGreaterThan(Date.now() + 50_000);
    await drain.execute();
    expect(calls).toBe(1);
    await database
      .update(notificationMessage)
      .set({ nextAttemptAt: new Date(0) })
      .where(eq(notificationMessage.id, queued.id));
    await drain.execute();
    [row] = await database
      .select()
      .from(notificationMessage)
      .where(eq(notificationMessage.id, queued.id));
    expect(calls).toBe(2);
    expect(row?.status).toBe("sent");
    expect(row?.attempts).toBe(2);
    expect(row?.providerId).toBe("qa-provider");
    expect(row?.secrets).toBeNull();
    expect(row?.lockedAt).toBeNull();
  }));

test("permanent failures and exhausted retries become terminal and clear secrets", () =>
  isolated(async (database) => {
    const messages = new DrizzleMessageRepository(database);
    const suppressions = new DrizzleSuppressionRepository(database);
    const warning = spyOn(Logger.prototype, "warn").mockImplementation(
      () => {},
    );
    const error = spyOn(Logger.prototype, "error").mockImplementation(() => {});
    try {
      for (const permanent of [true, false]) {
        const queued = message();
        await messages.enqueue(queued);
        const drain = new DrainQueueUseCase(
          messages,
          suppressions,
          {
            async send() {
              throw new ChannelError(
                "Carrier echoed Credential fixture-only and provider-token-fixture",
                permanent,
              );
            },
          },
          options,
        );
        for (let attempt = 0; attempt < (permanent ? 1 : 3); attempt += 1) {
          await database
            .update(notificationMessage)
            .set({ nextAttemptAt: new Date(0) })
            .where(eq(notificationMessage.id, queued.id));
          await drain.execute();
        }
        const [row] = await database
          .select()
          .from(notificationMessage)
          .where(eq(notificationMessage.id, queued.id));
        expect(row?.status).toBe("failed");
        expect(row?.attempts).toBe(permanent ? 1 : 3);
        expect(row?.secrets).toBeNull();
        expect(row?.completedAt).toBeInstanceOf(Date);
        expect(row?.lockedAt).toBeNull();
        expect(row?.error).toBe("The provider could not deliver the message");
        expect(JSON.stringify(row)).not.toContain("fixture-only");
        expect(JSON.stringify(row)).not.toContain("provider-token-fixture");
      }
      expect(warning).toHaveBeenCalledTimes(2);
      expect(error).toHaveBeenCalledTimes(2);
      expect(
        JSON.stringify([warning.mock.calls, error.mock.calls]),
      ).not.toContain("fixture-only");
      expect(
        JSON.stringify([warning.mock.calls, error.mock.calls]),
      ).not.toContain("provider-token-fixture");
    } finally {
      warning.mockRestore();
      error.mockRestore();
    }
  }));

test("dispatcher failures do not log raw database errors and allow a later pass", async () => {
  const messages = new DrizzleMessageRepository(db);
  const claim = spyOn(messages, "claimDue").mockRejectedValueOnce(
    new Error("Database error echoed fixture-password and provider-token"),
  );
  const log = spyOn(Logger.prototype, "error").mockImplementation(() => {});
  const drain = new DrainQueueUseCase(
    messages,
    new DrizzleSuppressionRepository(db),
    {
      async send() {
        throw new Error("No fixture messages should be claimed");
      },
    },
    options,
  );
  const dispatcher = new NotificationDispatcher(drain, options);
  try {
    await dispatcher.tick();
    claim.mockResolvedValue([]);
    await dispatcher.tick();
    expect(claim).toHaveBeenCalledTimes(2);
    expect(log).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(log.mock.calls)).not.toContain("fixture-password");
    expect(JSON.stringify(log.mock.calls)).not.toContain("provider-token");
  } finally {
    claim.mockRestore();
    log.mockRestore();
  }
});

test("a suppression arriving after enqueue blocks its channel and lifting it permits a new send", () =>
  isolated(async (database) => {
    const messages = new DrizzleMessageRepository(database);
    const suppressions = new DrizzleSuppressionRepository(database);
    const destination = `qa-${crypto.randomUUID()}@tagaroa.test`;
    const email = message({ destination });
    const sms = message({ channel: "sms", destination });
    await messages.enqueue(email);
    await messages.enqueue(sms);
    await database
      .update(notificationMessage)
      .set({ nextAttemptAt: new Date(0) })
      .where(inArray(notificationMessage.id, [email.id, sms.id]));
    const refusal = Suppression.raise({
      channel: "email",
      destination,
      reason: "bounced",
    });
    await suppressions.add(refusal);
    await suppressions.add(refusal);
    expect(await suppressions.reasonFor("email", destination)).toBe("bounced");
    const sent: string[] = [];
    const drain = new DrainQueueUseCase(
      messages,
      suppressions,
      {
        async send(outgoing) {
          sent.push(outgoing.id);
          return { providerId: outgoing.id };
        },
      },
      options,
    );
    await drain.execute();
    expect(sent).toEqual([sms.id]);
    const [row] = await database
      .select()
      .from(notificationMessage)
      .where(eq(notificationMessage.id, email.id));
    expect(row?.status).toBe("suppressed");
    expect(row?.secrets).toBeNull();
    expect(row?.lockedAt).toBeNull();
    expect(await suppressions.lift(refusal.id)).toBe("email");
    expect(await suppressions.lift(refusal.id)).toBeUndefined();
    const next = message({ destination });
    await messages.enqueue(next);
    await database
      .update(notificationMessage)
      .set({ nextAttemptAt: new Date(0) })
      .where(eq(notificationMessage.id, next.id));
    await drain.execute();
    expect(sent).toContain(next.id);
  }));

test("queue idempotency, stale claim recovery and 200-message batch draining persist correctly", () =>
  isolated(async (database) => {
    const messages = new DrizzleMessageRepository(database);
    const suppressions = new DrizzleSuppressionRepository(database);
    const idempotencyKey = crypto.randomUUID();
    const first = message({ idempotencyKey });
    expect(await messages.enqueue(first)).toMatchObject({
      id: first.id,
      status: "pending",
    });
    expect(await messages.enqueue(message({ idempotencyKey }))).toBeUndefined();
    expect(await messages.findByIdempotencyKey(idempotencyKey)).toMatchObject({
      id: first.id,
    });
    await database
      .update(notificationMessage)
      .set({ status: "sending", lockedAt: new Date(Date.now() - 6 * 60_000) })
      .where(eq(notificationMessage.id, first.id));
    await Promise.all(
      Array.from({ length: 199 }, () => messages.enqueue(message())),
    );
    const sent = new Set<string>();
    const drain = new DrainQueueUseCase(
      messages,
      suppressions,
      {
        async send(outgoing) {
          expect(sent.has(outgoing.id)).toBe(false);
          sent.add(outgoing.id);
          return { providerId: outgoing.id };
        },
      },
      options,
    );
    for (let batch = 0; batch < 8; batch += 1) await drain.execute();
    expect(sent.size).toBe(200);
    await drain.execute();
    expect(sent.size).toBe(200);
    const rows = await database.select().from(notificationMessage);
    expect(
      rows.every(
        (row) =>
          row.status === "sent" &&
          row.secrets === null &&
          row.lockedAt === null,
      ),
    ).toBe(true);
  }));

test("a drainer that stalled past the reclaim window cannot overwrite the newer claim", () =>
  isolated(async (database) => {
    const messages = new DrizzleMessageRepository(database);
    const queued = message();
    await messages.enqueue(queued);
    await database
      .update(notificationMessage)
      .set({ nextAttemptAt: new Date(0) })
      .where(eq(notificationMessage.id, queued.id));

    const [stalled] = await messages.claimDue(1);
    // Six minutes pass with no outcome, so the row is orphaned and reclaimed.
    await database
      .update(notificationMessage)
      .set({ lockedAt: new Date(Date.now() - 6 * 60_000) })
      .where(eq(notificationMessage.id, queued.id));
    const [current] = await messages.claimDue(1);
    expect(current?.id).toBe(queued.id);

    // The stalled drainer finishes late and fails; the newer claim is untouched.
    await messages.recordFailure(
      stalled!,
      { status: "pending", delaySeconds: 60 },
      "late failure",
    );
    let [row] = await database
      .select()
      .from(notificationMessage)
      .where(eq(notificationMessage.id, queued.id));
    expect(row?.status).toBe("sending");
    expect(row?.error).toBeNull();

    await messages.markSent(current!, "qa-provider");
    // And a late success from the stalled one cannot rewrite the record either.
    await messages.markSent(stalled!, "stale-provider");
    [row] = await database
      .select()
      .from(notificationMessage)
      .where(eq(notificationMessage.id, queued.id));
    expect(row?.status).toBe("sent");
    expect(row?.providerId).toBe("qa-provider");
    expect(row?.attempts).toBe(2);
  }));

test("an out-of-order receipt does not move a delivered message backwards", () =>
  isolated(async (database) => {
    const messages = new DrizzleMessageRepository(database);
    const queued = message();
    await messages.enqueue(queued);
    await database
      .update(notificationMessage)
      .set({ nextAttemptAt: new Date(0) })
      .where(eq(notificationMessage.id, queued.id));
    const [claimed] = await messages.claimDue(1);
    await messages.markSent(claimed!, "qa-receipt");

    const receipt = (status: "bounced" | "delivered" | "sent") =>
      messages.applyReceipt({
        destination: null,
        providerId: "qa-receipt",
        status,
        suppress: null,
      });
    const status = async () =>
      (
        await database
          .select({ status: notificationMessage.status })
          .from(notificationMessage)
          .where(eq(notificationMessage.id, queued.id))
      )[0]?.status;

    await receipt("delivered");
    await receipt("sent");
    expect(await status()).toBe("delivered");
    await receipt("bounced");
    await receipt("delivered");
    expect(await status()).toBe("bounced");
  }));
