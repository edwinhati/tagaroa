import type { Collection } from "@repo/contracts";

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

/** The fields each log can be sorted by. Both open newest first. */
export const MESSAGE_SORT_FIELDS = [
  "channel",
  "createdAt",
  "destination",
  "key",
  "status",
] as const;
export const SUPPRESSION_SORT_FIELDS = [
  "channel",
  "createdAt",
  "destination",
  "reason",
] as const;
export const NEWEST_FIRST = "-createdAt";

/**
 * What the notification admin endpoints answer with. Rows as the console lists
 * them, not entities: the log is filtered, faceted and paged in SQL, so core's
 * query port answers in these and its write side keeps the entities.
 */
export interface TemplateRow {
  id: string;
  key: string;
  channel: NotificationChannel;
  locale: string;
  version: number;
  status: TemplateStatus;
  subject: string | null;
  body: string;
  variables: string[];
  /**
   * Which variables this wording withholds from the message log. Read back so
   * that editing wording carries the declaration into the next version rather
   * than quietly dropping it.
   */
  secrets: string[];
  updatedAt: Date;
}

export interface MessageRow {
  id: string;
  key: string;
  channel: NotificationChannel;
  locale: string;
  destination: string;
  status: MessageStatus;
  attempts: number;
  error: string | null;
  /** The provider's own id, which its webhook reports against. */
  providerId: string | null;
  subject: string | null;
  body: string;
  createdAt: Date;
  sentAt: Date | null;
  completedAt: Date | null;
}

export interface SuppressionRow {
  id: string;
  channel: NotificationChannel;
  destination: string;
  reason: SuppressionReason;
  createdAt: Date;
}

export interface ChannelHealth {
  channel: NotificationChannel;
  /** Who carries it: Resend, Twilio, Meta. */
  provider: string;
  /** Whether this deployment holds credentials for it. */
  configured: boolean;
  queued: number;
  sent: number;
  delivered: number;
  failed: number;
  suppressed: number;
}

export interface NotificationOverview {
  /**
   * False when no channel holds credentials, so every message writes to the
   * log instead of reaching a provider.
   */
  live: boolean;
  channels: Collection<ChannelHealth>;
  totals: {
    queued: number;
    sent: number;
    delivered: number;
    failed: number;
    suppressed: number;
  };
  /** One point per day for a fortnight, zero-filled. */
  series: Collection<{ day: string; sent: number; failed: number }>;
}
