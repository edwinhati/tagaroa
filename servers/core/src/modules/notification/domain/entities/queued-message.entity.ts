import type { ChannelError } from "../errors/channel.error";
import type {
  NotificationChannel,
  NotificationPayload,
} from "../value-objects/notification-channel.vo";
import { renderText } from "../value-objects/rendered-payload.vo";
import {
  type DeliveryOutcome,
  outcomeFor,
} from "../value-objects/retry-policy.vo";

export interface QueuedMessageProps {
  id: string;
  channel: NotificationChannel;
  destination: string;
  locale: string;
  payload: NotificationPayload;
  /**
   * The values the stored payload deliberately does not hold. Null once the
   * message has left, which is what makes the row permanently safe to keep.
   */
  secrets: Record<string, string> | null;
  /** Already incremented by the claim that produced this. */
  attempts: number;
  /**
   * The `lockedAt` this claim stamped. It is the claim's token: a drainer that
   * stalls past the reclaim window and finishes after another has taken the
   * row over must not overwrite what the newer claim recorded.
   */
  claimedAt: Date;
}

/**
 * A message the dispatcher has claimed and is about to try.
 *
 * A second entity over the same table rather than a fuller `Message`, because
 * the queue reads six columns and the log reads fourteen: loading the rest to
 * decide a retry would be work done for nothing, on every message, every pass.
 *
 * It answers the one question the dispatcher asks — what does this failure
 * mean — so the retry rule stays a domain fact rather than a branch inside a
 * timer.
 */
export class QueuedMessage {
  private constructor(private readonly props: QueuedMessageProps) {}

  static restore(props: QueuedMessageProps): QueuedMessage {
    return new QueuedMessage(props);
  }

  static suppressionKey(
    channel: NotificationChannel,
    destination: string,
  ): string {
    return `${channel}:${destination}`;
  }

  get id(): string {
    return this.props.id;
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

  get attempts(): number {
    return this.props.attempts;
  }

  get claimedAt(): Date {
    return this.props.claimedAt;
  }

  /**
   * The message as the recipient must read it: the stored payload with its
   * secrets substituted back in, in memory, on the way to the carrier.
   *
   * `renderText` refuses an unresolved placeholder, so a row whose secrets have
   * already been cleared cannot be sent again as literal `{{password}}` — it
   * throws instead, which is the right answer for a credential nobody holds any
   * more.
   */
  get outgoingPayload(): NotificationPayload {
    const secrets = this.props.secrets ?? {};

    return {
      body: renderText(this.props.payload.body, secrets),
      subject:
        this.props.payload.subject === null
          ? null
          : renderText(this.props.payload.subject, secrets),
      variables: this.props.payload.variables,
    };
  }

  /** How this destination appears in the suppression list. */
  get suppressionKey(): string {
    return QueuedMessage.suppressionKey(
      this.props.channel,
      this.props.destination,
    );
  }

  /** Whether this failure is worth another attempt, and how long to wait. */
  outcomeAfter(
    error: ChannelError | unknown,
    maxAttempts: number,
  ): DeliveryOutcome {
    return outcomeFor(error, this.props.attempts, maxAttempts);
  }
}
