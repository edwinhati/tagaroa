import { sql } from "drizzle-orm";
import {
  index,
  integer,
  pgSchema,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { jsonb } from "../../../../../platform/database/jsonb";
import { user } from "../../../../auth/infrastructure/persistence/drizzle/schema";
import type {
  NotificationChannel,
  NotificationPayload,
} from "../../../domain/value-objects/notification-channel.vo";

/**
 * Ours, like `directory` and unlike `auth`: hand-written, never regenerated.
 * `drizzle.config.ts` lists it in `schemaFilter` and `schema.registry.ts`
 * re-exports it, which is what carries these tables into migrations.
 */
export const notificationSchema = pgSchema("notification");

/**
 * The wording of one message, per channel and per language.
 *
 * `body` is the text for email and SMS. For WhatsApp it is the name of a
 * template Meta has already approved — business-initiated WhatsApp messages
 * cannot carry free text, so the row holds the name and `variables` holds the
 * order its positional parameters are filled in.
 *
 * Rows are versioned and only one version per (key, channel, locale) is
 * published, so editing wording in the admin app cannot change a message that
 * is already queued: the send renders from the published row at enqueue time
 * and keeps the result.
 */
export const notificationTemplate = notificationSchema.table(
  "template",
  {
    id: text("id").primaryKey(),
    /** What happened, in dotted form: `account.issued`. */
    key: text("key").notNull(),
    channel: text("channel").notNull().$type<NotificationChannel>(),
    locale: text("locale").notNull(),
    version: integer("version").notNull().default(1),
    /** `draft` or `published`. One published row per key/channel/locale. */
    status: text("status").notNull().default("draft"),
    /** Email only; null everywhere else. */
    subject: text("subject"),
    body: text("body").notNull(),
    /** Variable names, in the order WhatsApp's positional parameters need. */
    variables: jsonb<string[]>("variables")
      .notNull()
      .default(sql`'[]'::jsonb`),
    /**
     * Which of those variables must never be written down. Rendering leaves
     * them standing as `{{name}}` in the stored payload and puts the values in
     * `message.secrets`, which is cleared the moment the message leaves.
     */
    secrets: jsonb<string[]>("secrets")
      .notNull()
      .default(sql`'[]'::jsonb`),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    // Null once the author's account is gone; the wording stands.
    updatedBy: text("updated_by").references(() => user.id, {
      onDelete: "set null",
    }),
  },
  (table) => [
    uniqueIndex("notificationTemplate_version_idx").on(
      table.key,
      table.channel,
      table.locale,
      table.version,
    ),
    uniqueIndex("notificationTemplate_published_idx")
      .on(table.key, table.channel, table.locale)
      .where(sql`${table.status} = 'published'`),
  ],
);

/**
 * One message: the audit row and the queue row at once.
 *
 * Being the same row is the point. A separate broker would mean writing here
 * and publishing there, two writes that can disagree; this one is inserted in
 * the caller's own transaction, so a message exists exactly when the thing that
 * caused it does. `status`, `attempts` and `next_attempt_at` are what the
 * dispatcher claims against, and the provider webhook later writes the
 * delivered/bounced outcome onto the same row.
 */
export const notificationMessage = notificationSchema.table(
  "message",
  {
    id: text("id").primaryKey(),
    key: text("key").notNull(),
    channel: text("channel").notNull().$type<NotificationChannel>(),
    locale: text("locale").notNull(),
    /** The address, number, or WhatsApp number this went to. */
    destination: text("destination").notNull(),
    // Null once the template row is gone; what was rendered from it stays.
    templateId: text("template_id").references(() => notificationTemplate.id, {
      onDelete: "set null",
    }),
    /** Rendered at enqueue: `{ subject, body, variables }`. */
    payload: jsonb<NotificationPayload>("payload").notNull(),
    /**
     * What the payload deliberately withholds, for as long as sending needs it.
     *
     * A temporary password is a live credential: keeping it in `payload` would
     * put it in the admin message log for as long as the row exists, which is
     * forever. It lives here instead and is nulled by the same statement that
     * marks the message sent, suppressed or finally failed — so the window is
     * the delivery itself, bounded by the retry policy, and every terminal
     * state closes it.
     */
    secrets: jsonb<Record<string, string>>("secrets"),
    /**
     * `pending` → `sending` → `sent`, then `delivered` or `bounced` when the
     * provider says so. `failed` is out of attempts; `suppressed` never left.
     */
    status: text("status").notNull().default("pending"),
    attempts: integer("attempts").notNull().default(0),
    nextAttemptAt: timestamp("next_attempt_at").notNull().defaultNow(),
    /** When the dispatcher claimed it; how a crashed send is recovered. */
    lockedAt: timestamp("locked_at"),
    /** The provider's own id, which is what its webhook reports against. */
    providerId: text("provider_id"),
    error: text("error"),
    /** The caller's key for "this send has already happened". */
    idempotencyKey: text("idempotency_key"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    sentAt: timestamp("sent_at"),
    completedAt: timestamp("completed_at"),
  },
  (table) => [
    // The dispatcher's claim query reads exactly this.
    index("notificationMessage_due_idx").on(table.status, table.nextAttemptAt),
    index("notificationMessage_providerId_idx").on(table.providerId),
    index("notificationMessage_destination_idx").on(
      table.channel,
      table.destination,
    ),
    // Postgres counts nulls as distinct, so the messages without a key — most
    // of them — do not collide with each other.
    uniqueIndex("notificationMessage_idempotency_idx").on(table.idempotencyKey),
  ],
);

/**
 * Who must not be contacted on a channel, and why.
 *
 * Twilio honours STOP on its own and Meta refuses un-opted numbers, but neither
 * tells the other, and neither stops the next send from being attempted and
 * charged. A bounce or an opt-out webhook writes a row here; the dispatcher
 * refuses a destination that has one.
 */
export const notificationSuppression = notificationSchema.table(
  "suppression",
  {
    id: text("id").primaryKey(),
    channel: text("channel").notNull().$type<NotificationChannel>(),
    destination: text("destination").notNull(),
    /** `bounced`, `complained`, `opted-out`, or `manual`. */
    reason: text("reason").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("notificationSuppression_destination_idx").on(
      table.channel,
      table.destination,
    ),
  ],
);
