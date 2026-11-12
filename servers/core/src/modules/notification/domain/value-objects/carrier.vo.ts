import type { NotificationChannel } from "@repo/contracts/notifications";

/**
 * Who carries each channel: the company, the name its webhooks arrive under,
 * and the credential that configures it. A fourth channel is one row here.
 */
export const CARRIERS = {
  email: { credential: "resend", name: "Resend", provider: "resend" },
  sms: { credential: "twilio", name: "Twilio", provider: "twilio" },
  whatsapp: { credential: "whatsapp", name: "Meta", provider: "meta" },
} as const satisfies Record<
  NotificationChannel,
  { credential: string; name: string; provider: string }
>;

type Carrier = (typeof CARRIERS)[NotificationChannel];

export type ProviderName = Carrier["provider"];

/** The credentials a deployment holds, by the name each carrier reads. */
export type CarrierCredentials = Partial<
  Record<Carrier["credential"], unknown>
>;

const CHANNEL_BY_PROVIDER = new Map<string, NotificationChannel>(
  Object.entries(CARRIERS).map(([channel, { provider }]) => [
    provider,
    channel as NotificationChannel,
  ]),
);

export const isProviderName = (value: string): value is ProviderName =>
  CHANNEL_BY_PROVIDER.has(value);

/** Which channel a provider's receipts speak for; a suppression is per channel. */
export const channelOf = (provider: ProviderName): NotificationChannel =>
  CHANNEL_BY_PROVIDER.get(provider)!;
