import type { MessageStatus } from "@repo/contracts/notifications";

import type { Message } from "../entities/message.entity";
import type { QueuedMessage } from "../entities/queued-message.entity";
import type { Receipt } from "../value-objects/delivery-receipt.vo";
import type { DeliveryOutcome } from "../value-objects/retry-policy.vo";

export const MESSAGE_REPOSITORY = Symbol("MESSAGE_REPOSITORY");

export interface EnqueuedMessage {
  id: string;
  status: MessageStatus;
}

/**
 * The queue and the log, which are the same table.
 *
 * The state changes are named for what happened rather than exposing a general
 * `save`. A dispatcher that read a message, mutated it and wrote it back would
 * turn every delivery into a read-modify-write across the window in which
 * another process may have claimed it; each of these is one statement against
 * one row.
 */
export interface MessageRepository {
  /**
   * Insert, unless this exact send already happened. Undefined when the
   * idempotency key collided, which is not an error — the caller then asks for
   * the message that already exists.
   */
  enqueue(message: Message): Promise<EnqueuedMessage | undefined>;

  findByIdempotencyKey(key: string): Promise<EnqueuedMessage | undefined>;

  /**
   * Take up to `batchSize` due messages, marking them `sending` so no other
   * drainer takes the same ones.
   */
  claimDue(batchSize: number): Promise<QueuedMessage[]>;

  /*
   * The three ways a claim ends. Each applies only while the row is still held
   * by that claim; one that was reclaimed in the meantime is left to its newer
   * owner, and the write quietly does nothing.
   */
  markSent(message: QueuedMessage, providerId: string | null): Promise<void>;

  markSuppressedBeforeSending(message: QueuedMessage): Promise<void>;

  recordFailure(
    message: QueuedMessage,
    outcome: DeliveryOutcome,
    reason: string,
  ): Promise<void>;

  /** What a provider's webhook says became of a message it carried. */
  applyReceipt(receipt: Receipt): Promise<void>;
}
