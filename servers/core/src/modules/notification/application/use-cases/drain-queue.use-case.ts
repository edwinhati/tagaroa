import { Inject, Injectable, Logger } from "@nestjs/common";

import type { QueuedMessage } from "../../domain/entities/queued-message.entity";
import {
  MESSAGE_CARRIER,
  type MessageCarrier,
} from "../../domain/repositories/message-carrier.port";
import {
  MESSAGE_REPOSITORY,
  type MessageRepository,
} from "../../domain/repositories/message.repository";
import {
  SUPPRESSION_REPOSITORY,
  type SuppressionRepository,
} from "../../domain/repositories/suppression.repository";
import {
  DISPATCH_OPTIONS,
  type DispatchOptions,
} from "../notification.options";

/**
 * One pass of the queue: claim what is due, send it, record what happened.
 *
 * The half of sending that must not happen inside a request. Providers are
 * slow, rate-limited and occasionally down, and a message that fails has to be
 * tried again long after the response has been returned.
 *
 * Nothing here knows it runs on a timer — the scheduler that calls it is
 * infrastructure, which is what makes a pass testable and what makes moving the
 * dispatcher to its own process a second entrypoint rather than a rewrite.
 */
@Injectable()
export class DrainQueueUseCase {
  private readonly logger = new Logger(DrainQueueUseCase.name);

  constructor(
    @Inject(MESSAGE_REPOSITORY) private readonly messages: MessageRepository,
    @Inject(SUPPRESSION_REPOSITORY)
    private readonly suppressions: SuppressionRepository,
    @Inject(MESSAGE_CARRIER) private readonly carrier: MessageCarrier,
    @Inject(DISPATCH_OPTIONS) private readonly options: DispatchOptions,
  ) {}

  async execute(): Promise<void> {
    const claimed = await this.messages.claimDue(this.options.batchSize);
    if (claimed.length === 0) return;

    // Re-checked here, not only at enqueue: a bounce or a STOP that arrives
    // while a message waits in the queue must stop it going out.
    const suppressed = await this.suppressions.keysAmong(
      claimed.map((message) => message.destination),
    );

    await Promise.all(
      claimed.map((message) =>
        suppressed.has(message.suppressionKey)
          ? this.messages.markSuppressedBeforeSending(message)
          : this.deliver(message),
      ),
    );
  }

  private async deliver(message: QueuedMessage): Promise<void> {
    try {
      const { providerId } = await this.carrier.send({
        channel: message.channel,
        destination: message.destination,
        id: message.id,
        locale: message.locale,
        // Reassembled here and nowhere else: the secret never reaches the
        // carrier port's callers, the log, or a second read of the row.
        payload: message.outgoingPayload,
      });
      await this.messages.markSent(message, providerId);
    } catch (error) {
      const outcome = message.outcomeAfter(error, this.options.maxAttempts);
      // Provider exceptions can echo credentials from the outgoing payload.
      const reason = "The provider could not deliver the message";

      await this.messages.recordFailure(message, outcome, reason);

      this.logger[outcome.status === "failed" ? "error" : "warn"](
        `${message.channel} ${message.id} attempt ${message.attempts}: ${reason}`,
      );
    }
  }
}
