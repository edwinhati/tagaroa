import { randomUUID } from "node:crypto";

import type { SuppressionReason } from "@repo/contracts/notifications";
import type { NotificationChannel } from "@repo/contracts/notifications";

export interface SuppressionProps {
  id: string;
  channel: NotificationChannel;
  destination: string;
  reason: SuppressionReason;
}

/**
 * Who must not be contacted on a channel, and why.
 *
 * Twilio honours STOP on its own and Meta refuses un-opted numbers, but neither
 * tells the other, and neither stops the next send from being attempted and
 * charged. This is the record that does.
 */
export class Suppression {
  private constructor(private readonly props: SuppressionProps) {}

  static raise(input: {
    channel: NotificationChannel;
    destination: string;
    reason: SuppressionReason;
  }): Suppression {
    return new Suppression({ ...input, id: randomUUID() });
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

  get reason(): SuppressionReason {
    return this.props.reason;
  }
}
