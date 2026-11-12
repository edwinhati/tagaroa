/** The words the notification module and its admin console share. */

/** The three ways a message can leave the building. */
export const NOTIFICATION_CHANNELS = ["email", "sms", "whatsapp"] as const;
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];

/** What became of one message, from queued to its provider's last word. */
export const MESSAGE_STATUSES = [
  "pending",
  "sending",
  "sent",
  "delivered",
  "failed",
  "bounced",
  "suppressed",
] as const;
export type MessageStatus = (typeof MESSAGE_STATUSES)[number];

/** A wording is written, published, and retired. */
export const TEMPLATE_STATUSES = ["draft", "published", "archived"] as const;
export type TemplateStatus = (typeof TEMPLATE_STATUSES)[number];

/** Why a destination stopped receiving a channel. */
export const SUPPRESSION_REASONS = [
  "bounced",
  "complained",
  "opted-out",
  "failed",
] as const;
export type SuppressionReason = (typeof SUPPRESSION_REASONS)[number];
