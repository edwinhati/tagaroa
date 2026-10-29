import {
  type NotificationChannel,
  NOTIFICATION_CHANNELS,
} from "../value-objects/notification-channel.vo";

/** What `channelStatus()` computed at wiring time, for the admin surface. */
export const CHANNEL_STATUS = Symbol("CHANNEL_STATUS");

export interface ChannelStatus {
  channel: NotificationChannel;
  /** Who carries it: Resend, Twilio, Meta. */
  provider: string;
  /** Whether this deployment holds credentials for it. */
  configured: boolean;
}

export interface DeliveryStatus {
  /**
   * Whether anything can actually leave the building: true once a single
   * channel holds its credentials. A deployment with none writes every message
   * to the log instead, and the surface says so rather than letting an admin
   * believe one was delivered.
   */
  live: boolean;
  channels: ChannelStatus[];
}

/** Which credential proves a channel is configured, and who carries it. */
export interface CarrierCredentials {
  resend?: unknown;
  twilio?: unknown;
  whatsapp?: unknown;
}

const CARRIER: Record<
  NotificationChannel,
  { name: string; credential: keyof CarrierCredentials }
> = {
  email: { credential: "resend", name: "Resend" },
  sms: { credential: "twilio", name: "Twilio" },
  whatsapp: { credential: "whatsapp", name: "Meta" },
};

/**
 * What this deployment can actually send on.
 *
 * A domain rule rather than a detail of the admin surface: "configured" has to
 * mean the same thing to the page that reports it and to the dispatcher that
 * refuses an unconfigured channel, and a fourth channel has to be added in one
 * place.
 */
export const channelStatus = (
  providers: CarrierCredentials,
): DeliveryStatus => {
  const channels = NOTIFICATION_CHANNELS.map((channel) => ({
    channel,
    configured: providers[CARRIER[channel].credential] !== undefined,
    provider: CARRIER[channel].name,
  }));

  // Credentials, not the environment. A developer who sets a Resend test key
  // exercises the real carrier — the one part of delivery that a console sender
  // can never test — and one who sets nothing is unaffected.
  return { channels, live: channels.some((channel) => channel.configured) };
};
