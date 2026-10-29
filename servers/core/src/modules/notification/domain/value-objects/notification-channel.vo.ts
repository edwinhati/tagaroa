/** The three ways a message can leave the building. */
export const NOTIFICATION_CHANNELS = ["email", "sms", "whatsapp"] as const;
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];

/**
 * What was rendered for one message, kept as written.
 *
 * `variables` is filled only for WhatsApp, whose approved templates take
 * positional parameters rather than a body; for email and SMS the body is
 * already the finished text and the list is empty.
 */
export interface NotificationPayload {
  subject: string | null;
  body: string;
  variables: string[];
}
