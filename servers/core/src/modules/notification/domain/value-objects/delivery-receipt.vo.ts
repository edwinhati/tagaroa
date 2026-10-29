import type { NotificationChannel } from "./notification-channel.vo";

/**
 * One provider's word on one message. `suppress` is set when the outcome says
 * this destination must not be written to again — a hard bounce, a complaint,
 * an opt-out — which is the part no provider tells the other two about.
 */
export interface Receipt {
  providerId: string;
  status: "bounced" | "delivered" | "sent";
  destination: string | null;
  suppress: string | null;
}

/**
 * The message statuses a receipt may replace. Providers do not promise to
 * deliver their webhooks in order, so a late `email.sent` or
 * `delivery_delayed` must not turn a delivered message back into a sent one.
 * A bounce outranks a delivery: it is the later and the more useful news.
 */
export const replaceableBy = (status: Receipt["status"]): readonly string[] =>
  ({
    bounced: ["sent", "delivered", "bounced"],
    delivered: ["sent", "delivered"],
    sent: ["sent"],
  })[status];

/** Which channel each provider speaks for; a suppression is per channel. */
export const PROVIDER_CHANNELS = {
  meta: "whatsapp",
  resend: "email",
  twilio: "sms",
} as const satisfies Record<string, NotificationChannel>;

export type ProviderName = keyof typeof PROVIDER_CHANNELS;

export const isProviderName = (value: string): value is ProviderName =>
  value in PROVIDER_CHANNELS;
