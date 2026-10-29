import { Logger } from "@nestjs/common";

import { ChannelError } from "../../domain/errors/channel.error";
import type {
  ChannelResult,
  MessageCarrier,
  OutgoingMessage,
} from "../../domain/repositories/message-carrier.port";
import { type NotificationChannel } from "../../domain/value-objects/notification-channel.vo";
import { resendSender, type ResendConfig } from "./resend.channel";
import { twilioSender, type TwilioConfig } from "./twilio.channel";
import { whatsAppSender, type WhatsAppConfig } from "./whatsapp.channel";

export type ChannelSender = (
  message: OutgoingMessage,
) => Promise<ChannelResult>;

export interface NotificationProviders {
  /**
   * Whether a channel with no credentials is an error rather than a log line.
   *
   * True in production, where a message that quietly went nowhere is worse than
   * one that failed loudly. Everywhere else an unconfigured channel writes to
   * the log, so the repo runs with no credentials at all — but a channel that
   * *does* hold credentials sends for real in every environment, which is the
   * only way the hand-rolled carriers are ever exercised before production.
   */
  strict: boolean;
  resend?: ResendConfig;
  twilio?: TwilioConfig;
  whatsapp?: WhatsAppConfig;
}

const consoleSender =
  (logger: Logger): ChannelSender =>
  async (message) => {
    logger.log(
      `${message.channel} to ${message.destination}: ${message.payload.subject ?? message.payload.body}`,
    );
    return { providerId: `console_${message.id}` };
  };

const unconfigured =
  (channel: NotificationChannel): ChannelSender =>
  () => {
    throw new ChannelError(`The ${channel} channel is not configured`, true);
  };

export const createChannels = (
  providers: NotificationProviders,
  logger: Logger = new Logger("Notification"),
): Record<NotificationChannel, ChannelSender> => {
  const missing = (channel: NotificationChannel): ChannelSender =>
    providers.strict ? unconfigured(channel) : consoleSender(logger);

  return {
    email: providers.resend ? resendSender(providers.resend) : missing("email"),
    sms: providers.twilio ? twilioSender(providers.twilio) : missing("sms"),
    whatsapp: providers.whatsapp
      ? whatsAppSender(providers.whatsapp)
      : missing("whatsapp"),
  };
};

/**
 * The carrier port, resolved per channel.
 *
 * The adapter the dispatcher actually holds. It picks the sender by the
 * message's own channel, so the use case above it sends without knowing that
 * three different companies are involved — or that outside production none of
 * them is.
 */
export class ChannelCarrier implements MessageCarrier {
  private readonly senders: Record<NotificationChannel, ChannelSender>;

  constructor(providers: NotificationProviders, logger?: Logger) {
    this.senders = createChannels(providers, logger);
  }

  async send(message: OutgoingMessage): Promise<ChannelResult> {
    return this.senders[message.channel](message);
  }
}
