import { Logger } from "@nestjs/common";
import {
  NOTIFICATION_CHANNELS,
  type NotificationChannel,
} from "@repo/contracts/notifications";

import { ChannelError } from "../../domain/errors/channel.error";
import type {
  ChannelResult,
  MessageCarrier,
  OutgoingMessage,
} from "../../domain/repositories/message-carrier.port";
import { CARRIERS } from "../../domain/value-objects/carrier.vo";
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

type Credential = (typeof CARRIERS)[NotificationChannel]["credential"];

/** The sender each credential builds; `CARRIERS` says which channel it carries. */
const SENDERS: {
  [K in Credential]: (
    config: NonNullable<NotificationProviders[K]>,
  ) => ChannelSender;
} = { resend: resendSender, twilio: twilioSender, whatsapp: whatsAppSender };

const senderFor = <K extends Credential>(
  credential: K,
  providers: NotificationProviders,
): ChannelSender | undefined => {
  const config = providers[credential];
  return config ? SENDERS[credential](config) : undefined;
};

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

const createChannels = (
  providers: NotificationProviders,
  logger: Logger = new Logger("Notification"),
): Record<NotificationChannel, ChannelSender> => {
  const missing = (channel: NotificationChannel): ChannelSender =>
    providers.strict ? unconfigured(channel) : consoleSender(logger);

  return Object.fromEntries(
    NOTIFICATION_CHANNELS.map((channel) => [
      channel,
      senderFor(CARRIERS[channel].credential, providers) ?? missing(channel),
    ]),
  ) as Record<NotificationChannel, ChannelSender>;
};

/**
 * The carrier port, resolved per channel.
 *
 * The adapter the dispatcher actually holds. It picks the sender by the
 * message's own channel, so the use case above it sends without knowing that
 * three different companies are involved — or that a channel without
 * credentials is the console.
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
