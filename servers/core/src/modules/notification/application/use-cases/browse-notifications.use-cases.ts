import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { ApiDocument, Collection } from "@repo/contracts";

import {
  pageCollection,
  parseCollectionQuery,
  type QueryRecord,
} from "../../../../platform/http/collection";
import {
  AUDIT_TRAIL,
  type AuditTrail,
} from "../../../audit/application/audit.facade";
import {
  SUPPRESSION_REPOSITORY,
  type SuppressionRepository,
} from "../../domain/repositories/suppression.repository";
import {
  CHANNEL_STATUS,
  type DeliveryStatus,
} from "../../domain/services/channel-status.service";
import type {
  ChannelHealth,
  MessageRow,
  NotificationOverview,
  SuppressionRow,
} from "../dto/notification.read-models";
import {
  NOTIFICATION_QUERY,
  type NotificationQuery,
} from "../ports/notification-query.port";

/** A day this far back is where the chart starts. */
const SERIES_DAYS = 14;

const dayKey = (date: Date): string => date.toISOString().slice(0, 10);

/**
 * Delivery health at a glance: what is waiting, what left, what came back.
 *
 * The counts are per channel because the channels fail independently. An
 * expired WhatsApp token is invisible in a total that email dominates, and
 * because an unconfigured channel is a different fact from a quiet one.
 */
@Injectable()
export class GetNotificationOverviewUseCase {
  constructor(
    @Inject(NOTIFICATION_QUERY) private readonly query: NotificationQuery,
    @Inject(CHANNEL_STATUS) private readonly delivery: DeliveryStatus,
  ) {}

  async execute(
    rawQuery: QueryRecord,
    path: string,
  ): Promise<ApiDocument<NotificationOverview>> {
    const tallies = await this.query.tallies(SERIES_DAYS);

    const at = <T extends { channel: string }>(rows: T[], channel: string) =>
      rows.find((row) => row.channel === channel);

    const channels = this.delivery.channels.map((status): ChannelHealth => {
      const window = at(tallies.recent, status.channel);
      return {
        ...status,
        delivered: window?.delivered ?? 0,
        failed: window?.failed ?? 0,
        queued: at(tallies.queued, status.channel)?.queued ?? 0,
        sent: window?.sent ?? 0,
        suppressed: at(tallies.suppressed, status.channel)?.suppressed ?? 0,
      };
    });

    const days = Array.from({ length: SERIES_DAYS }, (_, index) => {
      const date = new Date();
      date.setUTCDate(date.getUTCDate() - (SERIES_DAYS - 1 - index));
      const day = dayKey(date);
      const point = tallies.series.find((row) => row.day === day);
      return { day, failed: point?.failed ?? 0, sent: point?.sent ?? 0 };
    });

    const total = (pick: (channel: ChannelHealth) => number) =>
      channels.reduce((sum, channel) => sum + pick(channel), 0);

    const page = <T>(rows: T[], prefix: string) =>
      pageCollection(rows, parseCollectionQuery(rawQuery, { prefix }), {
        path,
        prefix,
        rawQuery,
      });

    return {
      data: {
        channels: page(channels, "channels"),
        live: this.delivery.live,
        series: page(days, "series"),
        totals: {
          delivered: total((channel) => channel.delivered),
          failed: total((channel) => channel.failed),
          queued: total((channel) => channel.queued),
          sent: total((channel) => channel.sent),
          suppressed: total((channel) => channel.suppressed),
        },
      },
    };
  }
}

/**
 * What was sent, newest first. Read-only on purpose: "did they get it?" is the
 * question this surface exists to answer, and re-sending is a decision for the
 * surface that caused the message in the first place.
 */
@Injectable()
export class ListMessagesUseCase {
  constructor(
    @Inject(NOTIFICATION_QUERY) private readonly query: NotificationQuery,
  ) {}

  async execute(
    rawQuery: QueryRecord,
    path: string,
  ): Promise<Collection<MessageRow>> {
    return this.query.pageMessages(rawQuery, path);
  }
}

/** Who the workspace has stopped writing to, and why. */
@Injectable()
export class ListSuppressionsUseCase {
  constructor(
    @Inject(NOTIFICATION_QUERY) private readonly query: NotificationQuery,
  ) {}

  async execute(
    rawQuery: QueryRecord,
    path: string,
  ): Promise<Collection<SuppressionRow>> {
    return this.query.pageSuppressions(rawQuery, path);
  }
}

/**
 * Lifting a suppression.
 *
 * An address that bounced during an outage is not an address that wants
 * nothing, which is why this is possible at all — and why the list that shows
 * it is visible rather than internal.
 */
@Injectable()
export class LiftSuppressionUseCase {
  constructor(
    @Inject(SUPPRESSION_REPOSITORY)
    private readonly suppressions: SuppressionRepository,
    @Inject(AUDIT_TRAIL) private readonly audit: AuditTrail,
  ) {}

  async execute(id: string, actorId: string): Promise<void> {
    const channel = await this.suppressions.lift(id);
    if (!channel) throw new NotFoundException("No suppression with that id");

    // Delivery to that destination resumes. The destination itself stays out
    // of the trail; the channel and the suppression id identify the act.
    await this.audit.record({
      actorId,
      detail: `${channel}:${id}`,
      type: "notification.suppression.removed",
    });
  }
}
