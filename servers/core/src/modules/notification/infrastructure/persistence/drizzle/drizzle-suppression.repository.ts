import { Inject, Injectable } from "@nestjs/common";
import { and, eq, inArray } from "drizzle-orm";

import { DATABASE } from "../../../../../platform/database/database.module";
import { QueuedMessage } from "../../../domain/entities/queued-message.entity";
import type { Suppression } from "../../../domain/entities/suppression.entity";
import type { SuppressionRepository } from "../../../domain/repositories/suppression.repository";
import type { NotificationChannel } from "../../../domain/value-objects/notification-channel.vo";
import type { Executor } from "./notification.executor";
import { suppressionMapper } from "./notification.mappers";
import { notificationSuppression } from "./schema";

@Injectable()
export class DrizzleSuppressionRepository implements SuppressionRepository {
  constructor(@Inject(DATABASE) private readonly executor: Executor) {}

  async reasonFor(
    channel: NotificationChannel,
    destination: string,
  ): Promise<string | undefined> {
    const [row] = await this.executor
      .select({ reason: notificationSuppression.reason })
      .from(notificationSuppression)
      .where(
        and(
          eq(notificationSuppression.channel, channel),
          eq(notificationSuppression.destination, destination),
        ),
      )
      .limit(1);

    return row?.reason;
  }

  /**
   * Matched on destination alone and keyed by channel afterwards: one query
   * serves a batch that spans all three, and the caller compares against the
   * key its own message carries.
   */
  async keysAmong(destinations: readonly string[]): Promise<Set<string>> {
    if (destinations.length === 0) return new Set();

    const rows = await this.executor
      .select({
        channel: notificationSuppression.channel,
        destination: notificationSuppression.destination,
      })
      .from(notificationSuppression)
      .where(inArray(notificationSuppression.destination, [...destinations]));

    return new Set(
      rows.map((row) =>
        QueuedMessage.suppressionKey(row.channel, row.destination),
      ),
    );
  }

  async add(suppression: Suppression): Promise<void> {
    // Nothing to update on a repeat: the first refusal is the one that counts.
    await this.executor
      .insert(notificationSuppression)
      .values(suppressionMapper.toPersistence(suppression))
      .onConflictDoNothing();
  }

  async lift(id: string): Promise<boolean> {
    const lifted = await this.executor
      .delete(notificationSuppression)
      .where(eq(notificationSuppression.id, id))
      .returning({ id: notificationSuppression.id });

    return lifted.length > 0;
  }
}
