import { randomUUID } from "node:crypto";

import type { NotificationChannel } from "../value-objects/notification-channel.vo";

export interface SuppressionProps {
  id: string;
  channel: NotificationChannel;
  destination: string;
  reason: string;
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
    reason: string;
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

  get reason(): string {
    return this.props.reason;
  }
}
