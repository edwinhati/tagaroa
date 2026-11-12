import type { Collection } from "@repo/contracts";
import type {
  MessageStatus,
  NotificationChannel,
  TemplateStatus,
} from "@repo/contracts/notifications";

/**
 * The read side.
 *
 * These are rows as the admin surface wants them, not entities. The log is
 * fourteen columns wide, filtered, faceted and paged in SQL — loading each row
 * into a `Message` to serialise it straight back out would be a domain model
 * used as a transport, and would move the paging into memory to no one's
 * benefit. So the query port answers in these, and the write side keeps the
 * entities.
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
  reason: string;
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
   * log instead of reaching a provider. The surface says so rather than letting
   * an admin believe a message left the building.
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

/** The tallies the overview is assembled from, straight out of SQL. */
export interface DeliveryTallies {
  recent: {
    channel: string;
    sent: number;
    delivered: number;
    failed: number;
  }[];
  queued: { channel: string; queued: number }[];
  suppressed: { channel: string; suppressed: number }[];
  series: { day: string; sent: number; failed: number }[];
}
