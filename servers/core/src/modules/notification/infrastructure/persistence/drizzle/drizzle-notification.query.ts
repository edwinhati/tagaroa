import { Inject, Injectable } from "@nestjs/common";
import type { Collection } from "@repo/contracts";
import {
  MESSAGE_STATUSES,
  NOTIFICATION_CHANNELS,
  SUPPRESSION_REASONS,
} from "@repo/contracts/notifications";
import { sql } from "drizzle-orm";

import { collectionOver } from "../../../../../platform/database/collection";
import {
  DATABASE,
  type Database,
} from "../../../../../platform/database/database.module";
import type { QueryRecord } from "../../../../../platform/http/collection";
import type {
  DeliveryTallies,
  MessageRow,
  SuppressionRow,
} from "../../../application/dto/notification.read-models";
import type { NotificationQuery } from "../../../application/ports/notification-query.port";
import { notificationMessage, notificationSuppression } from "./schema";

/**
 * The log carries the rendered subject and body, not just the metadata: the
 * question this surface answers is "what did they actually receive", and a row
 * that cannot show that sends someone to the database.
 */
const MESSAGES = collectionOver<MessageRow>(notificationMessage, {
  defaultSort: "-createdAt",
  filters: {
    channel: {
      column: notificationMessage.channel,
      values: NOTIFICATION_CHANNELS,
    },
    status: { column: notificationMessage.status, values: MESSAGE_STATUSES },
  },
  search: [notificationMessage.destination, notificationMessage.key],
  select: {
    attempts: notificationMessage.attempts,
    body: sql<string>`${notificationMessage.payload}->>'body'`,
    channel: notificationMessage.channel,
    completedAt: notificationMessage.completedAt,
    createdAt: notificationMessage.createdAt,
    destination: notificationMessage.destination,
    error: notificationMessage.error,
    id: notificationMessage.id,
    key: notificationMessage.key,
    locale: notificationMessage.locale,
    providerId: notificationMessage.providerId,
    sentAt: notificationMessage.sentAt,
    status: notificationMessage.status,
    subject: sql<string | null>`${notificationMessage.payload}->>'subject'`,
  },
  sort: {
    channel: notificationMessage.channel,
    createdAt: notificationMessage.createdAt,
    destination: notificationMessage.destination,
    key: notificationMessage.key,
    status: notificationMessage.status,
  },
});

const SUPPRESSIONS = collectionOver<SuppressionRow>(notificationSuppression, {
  defaultSort: "-createdAt",
  filters: {
    channel: {
      column: notificationSuppression.channel,
      values: NOTIFICATION_CHANNELS,
    },
    reason: {
      column: notificationSuppression.reason,
      values: SUPPRESSION_REASONS,
    },
  },
  search: [notificationSuppression.destination],
  select: {
    channel: notificationSuppression.channel,
    createdAt: notificationSuppression.createdAt,
    destination: notificationSuppression.destination,
    id: notificationSuppression.id,
    reason: notificationSuppression.reason,
  },
  sort: {
    channel: notificationSuppression.channel,
    createdAt: notificationSuppression.createdAt,
    destination: notificationSuppression.destination,
    reason: notificationSuppression.reason,
  },
});

/** Postgres counts are bigint, which arrives as a string unless it is cast. */
const tally = (predicate: ReturnType<typeof sql>) =>
  sql<number>`count(*) filter (where ${predicate})::int`;

/**
 * The read side, in SQL.
 *
 * The filtering, faceting, counting and paging all happen in the database and
 * answer in rows rather than entities, which is what keeps the write side a
 * domain model rather than a transport. The four tallies are one round of
 * queries because the overview asks all four questions at once.
 */
@Injectable()
export class DrizzleNotificationQuery implements NotificationQuery {
  constructor(@Inject(DATABASE) private readonly database: Database) {}

  async pageMessages(
    rawQuery: QueryRecord,
    path: string,
  ): Promise<Collection<MessageRow>> {
    return MESSAGES.page(this.database, rawQuery, { path });
  }

  async pageSuppressions(
    rawQuery: QueryRecord,
    path: string,
  ): Promise<Collection<SuppressionRow>> {
    return SUPPRESSIONS.page(this.database, rawQuery, { path });
  }

  async tallies(seriesDays: number): Promise<DeliveryTallies> {
    const since = sql`now() - interval '24 hours'`;
    const seriesFrom = sql`now() - interval '${sql.raw(String(seriesDays - 1))} days'`;

    const [recent, queued, suppressed, series] = await Promise.all([
      this.database
        .select({
          channel: notificationMessage.channel,
          delivered: tally(sql`${notificationMessage.status} = 'delivered'`),
          failed: tally(
            sql`${notificationMessage.status} in ('failed', 'bounced')`,
          ),
          sent: tally(
            sql`${notificationMessage.status} in ('sent', 'delivered')`,
          ),
        })
        .from(notificationMessage)
        .where(sql`${notificationMessage.createdAt} >= ${since}`)
        .groupBy(notificationMessage.channel),

      this.database
        .select({
          channel: notificationMessage.channel,
          queued: sql<number>`count(*)::int`,
        })
        .from(notificationMessage)
        .where(sql`${notificationMessage.status} in ('pending', 'sending')`)
        .groupBy(notificationMessage.channel),

      this.database
        .select({
          channel: notificationSuppression.channel,
          suppressed: sql<number>`count(*)::int`,
        })
        .from(notificationSuppression)
        .groupBy(notificationSuppression.channel),

      this.database
        .select({
          day: sql<string>`to_char(date_trunc('day', ${notificationMessage.createdAt}), 'YYYY-MM-DD')`,
          failed: tally(
            sql`${notificationMessage.status} in ('failed', 'bounced')`,
          ),
          sent: tally(
            sql`${notificationMessage.status} in ('sent', 'delivered')`,
          ),
        })
        .from(notificationMessage)
        .where(sql`${notificationMessage.createdAt} >= ${seriesFrom}`)
        .groupBy(sql`1`),
    ]);

    return { queued, recent, series, suppressed };
  }
}
