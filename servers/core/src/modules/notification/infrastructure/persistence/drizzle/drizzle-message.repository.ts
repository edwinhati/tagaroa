import { Inject, Injectable } from "@nestjs/common";
import { and, asc, eq, inArray, lt, lte, or, sql } from "drizzle-orm";

import { DATABASE } from "../../../../../platform/database/database.module";
import type { Message } from "../../../domain/entities/message.entity";
import type { QueuedMessage } from "../../../domain/entities/queued-message.entity";
import type {
  EnqueuedMessage,
  MessageRepository,
} from "../../../domain/repositories/message.repository";
import {
  type Receipt,
  replaceableBy,
} from "../../../domain/value-objects/delivery-receipt.vo";
import type { DeliveryOutcome } from "../../../domain/value-objects/retry-policy.vo";
import type { Executor } from "./notification.executor";
import { messageMapper, queuedMessageMapper } from "./notification.mappers";
import { notificationMessage } from "./schema";

/** A claimed message this long unfinished was orphaned by a crash or a deploy. */
const STALE_CLAIM_MINUTES = 5;

/**
 * The row is still this claim's: `sending`, stamped with the claim's own time.
 * A reclaim restamps `lockedAt`, so a drainer that stalled past the window and
 * finishes late matches nothing instead of overwriting a newer outcome.
 */
const stillHeld = (message: QueuedMessage) =>
  and(
    eq(notificationMessage.id, message.id),
    eq(notificationMessage.status, "sending"),
    eq(notificationMessage.lockedAt, message.claimedAt),
  );

/** The one place in the module that knows the queue is a Postgres table. */
@Injectable()
export class DrizzleMessageRepository implements MessageRepository {
  constructor(@Inject(DATABASE) private readonly executor: Executor) {}

  async enqueue(message: Message): Promise<EnqueuedMessage | undefined> {
    const [row] = await this.executor
      .insert(notificationMessage)
      .values(messageMapper.toPersistence(message))
      .onConflictDoNothing({ target: notificationMessage.idempotencyKey })
      .returning({
        id: notificationMessage.id,
        status: notificationMessage.status,
      });

    return row;
  }

  async findByIdempotencyKey(
    key: string,
  ): Promise<EnqueuedMessage | undefined> {
    const [row] = await this.executor
      .select({
        id: notificationMessage.id,
        status: notificationMessage.status,
      })
      .from(notificationMessage)
      .where(eq(notificationMessage.idempotencyKey, key))
      .limit(1);

    return row;
  }

  /**
   * Claim in one transaction so two drainers never take the same row: the rows
   * are locked with `skip locked`, then marked `sending` before the lock goes.
   * A row still `sending` after five minutes was orphaned mid-send, so it is
   * claimable again — at the cost of a possible duplicate, which is the right
   * side to err on for a message nobody may have received.
   */
  async claimDue(batchSize: number): Promise<QueuedMessage[]> {
    const now = new Date();
    const staleBefore = new Date(
      now.getTime() - STALE_CLAIM_MINUTES * 60 * 1000,
    );

    return this.executor.transaction(async (transaction) => {
      const due = await transaction
        .select({
          attempts: notificationMessage.attempts,
          channel: notificationMessage.channel,
          destination: notificationMessage.destination,
          id: notificationMessage.id,
          locale: notificationMessage.locale,
          payload: notificationMessage.payload,
          secrets: notificationMessage.secrets,
        })
        .from(notificationMessage)
        .where(
          or(
            and(
              eq(notificationMessage.status, "pending"),
              lte(notificationMessage.nextAttemptAt, now),
            ),
            and(
              eq(notificationMessage.status, "sending"),
              lt(notificationMessage.lockedAt, staleBefore),
            ),
          ),
        )
        .orderBy(asc(notificationMessage.nextAttemptAt))
        .limit(batchSize)
        .for("update", { skipLocked: true });

      if (due.length === 0) return [];

      await transaction
        .update(notificationMessage)
        .set({
          attempts: sql`${notificationMessage.attempts} + 1`,
          lockedAt: now,
          status: "sending",
        })
        .where(
          inArray(
            notificationMessage.id,
            due.map((message) => message.id),
          ),
        );

      return due.map((message) =>
        queuedMessageMapper.toDomain({
          ...message,
          attempts: message.attempts + 1,
          claimedAt: now,
        }),
      );
    });
  }

  async markSent(
    message: QueuedMessage,
    providerId: string | null,
  ): Promise<void> {
    await this.executor
      .update(notificationMessage)
      .set({
        error: null,
        lockedAt: null,
        providerId,
        // The message has left; nothing needs the credential again. `sent` is
        // reached by the dispatcher itself rather than by a provider webhook,
        // which is what makes this the reliable moment to clear it.
        secrets: null,
        sentAt: new Date(),
        status: "sent",
      })
      .where(stillHeld(message));
  }

  async markSuppressedBeforeSending(message: QueuedMessage): Promise<void> {
    await this.executor
      .update(notificationMessage)
      .set({
        completedAt: new Date(),
        error: "Suppressed before sending",
        lockedAt: null,
        secrets: null,
        status: "suppressed",
      })
      .where(stillHeld(message));
  }

  async recordFailure(
    message: QueuedMessage,
    outcome: DeliveryOutcome,
    reason: string,
  ): Promise<void> {
    await this.executor
      .update(notificationMessage)
      .set({
        completedAt: outcome.status === "failed" ? new Date() : null,
        error: reason,
        lockedAt: null,
        nextAttemptAt: new Date(
          Date.now() + (outcome.delaySeconds ?? 0) * 1000,
        ),
        // A retry still needs it; a message out of attempts never will.
        ...(outcome.status === "failed" ? { secrets: null } : {}),
        status: outcome.status,
      })
      .where(stillHeld(message));
  }

  /**
   * Keyed by the provider's own id, which is all its webhook reports. Only
   * moves a message forward; an out-of-order receipt matches nothing.
   */
  async applyReceipt(receipt: Receipt): Promise<void> {
    await this.executor
      .update(notificationMessage)
      .set({ completedAt: new Date(), status: receipt.status })
      .where(
        and(
          eq(notificationMessage.providerId, receipt.providerId),
          inArray(notificationMessage.status, [
            ...replaceableBy(receipt.status),
          ]),
        ),
      );
  }
}
