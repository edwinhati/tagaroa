import { randomUUID } from "node:crypto";

import type {
  NotificationChannel,
  NotificationPayload,
} from "../value-objects/notification-channel.vo";

export interface EnqueueInput {
  key: string;
  channel: NotificationChannel;
  destination: string;
  locale: string;
  payload: NotificationPayload;
  /** Held apart from the payload, and only until the message leaves. */
  secrets: Record<string, string> | null;
  templateId: string | null;
  idempotencyKey: string | null;
  /** Why this destination is refused, when it is. */
  suppressedReason: string | null;
}

interface MessageProps {
  id: string;
  key: string;
  channel: NotificationChannel;
  destination: string;
  locale: string;
  payload: NotificationPayload;
  secrets: Record<string, string> | null;
  templateId: string | null;
  idempotencyKey: string | null;
  status: string;
  error: string | null;
  completedAt: Date | null;
}

/**
 * One message, at the moment it is created.
 *
 * The invariant this entity exists to hold is that a suppressed message is
 * *finished*: it carries `suppressed`, the reason it was refused, and a
 * completion time, all three or none. Before, that was true only because a
 * single insert statement happened to set all three together — a second place
 * that enqueued a message could have written a suppressed row that the
 * dispatcher would then have tried to send.
 *
 * A suppressed destination still gets a row: "we did not send this, and why" is
 * the answer someone will come looking for.
 */
export class Message {
  private constructor(private readonly props: MessageProps) {}

  static enqueue(input: EnqueueInput): Message {
    const suppressed = input.suppressedReason !== null;

    return new Message({
      channel: input.channel,
      completedAt: suppressed ? new Date() : null,
      destination: input.destination,
      error: suppressed ? `Suppressed: ${input.suppressedReason}` : null,
      id: randomUUID(),
      idempotencyKey: input.idempotencyKey,
      key: input.key,
      locale: input.locale,
      payload: input.payload,
      // A message that never leaves must never hold one either.
      secrets: suppressed ? null : input.secrets,
      status: suppressed ? "suppressed" : "pending",
      templateId: input.templateId,
    });
  }

  get id(): string {
    return this.props.id;
  }

  get key(): string {
    return this.props.key;
  }

  get channel(): NotificationChannel {
    return this.props.channel;
  }

  get destination(): string {
    return this.props.destination;
  }

  get locale(): string {
    return this.props.locale;
  }

  get payload(): NotificationPayload {
    return this.props.payload;
  }

  get secrets(): Record<string, string> | null {
    return this.props.secrets;
  }

  get templateId(): string | null {
    return this.props.templateId;
  }

  get idempotencyKey(): string | null {
    return this.props.idempotencyKey;
  }

  get status(): string {
    return this.props.status;
  }

  get error(): string | null {
    return this.props.error;
  }

  get completedAt(): Date | null {
    return this.props.completedAt;
  }
}
