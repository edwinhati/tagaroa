import type {
  NotificationChannel,
  NotificationPayload,
} from "../value-objects/notification-channel.vo";

export const MESSAGE_CARRIER = Symbol("MESSAGE_CARRIER");

export interface OutgoingMessage {
  id: string;
  channel: NotificationChannel;
  destination: string;
  locale: string;
  payload: NotificationPayload;
}

/** The provider's id for the message, which its webhook reports against. */
export interface ChannelResult {
  providerId: string | null;
}

/**
 * Whoever actually carries a message out of the building.
 *
 * The one port in this service with more than one real implementation —
 * Resend, Twilio, Meta and a console sender that stands in for all three
 * outside production. That is what makes it a seam rather than an abstraction:
 * the alternatives already exist.
 */
export interface MessageCarrier {
  send(message: OutgoingMessage): Promise<ChannelResult>;
}
