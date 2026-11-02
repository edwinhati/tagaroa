import { randomUUID } from "node:crypto";

import { Inject, Injectable } from "@nestjs/common";
import { and, desc, eq, inArray, max, sql } from "drizzle-orm";

import { DATABASE } from "../../../../../platform/database/database.module";
import type { Template } from "../../../domain/entities/template.entity";
import type { TemplateRepository } from "../../../domain/repositories/template.repository";
import type { NotificationChannel } from "../../../domain/value-objects/notification-channel.vo";
import type { TemplateDraft } from "../../../domain/value-objects/template-draft.vo";
import type { Executor } from "./notification.executor";
import { templateMapper } from "./notification.mappers";
import { notificationTemplate } from "./schema";

@Injectable()
export class DrizzleTemplateRepository implements TemplateRepository {
  constructor(@Inject(DATABASE) private readonly executor: Executor) {}

  async publishedFor(
    key: string,
    channel: NotificationChannel,
    locales: readonly string[],
  ): Promise<Template[]> {
    const rows = await this.executor
      .select()
      .from(notificationTemplate)
      .where(
        and(
          eq(notificationTemplate.key, key),
          eq(notificationTemplate.channel, channel),
          eq(notificationTemplate.status, "published"),
          inArray(notificationTemplate.locale, [...locales]),
        ),
      );

    return rows.map(templateMapper.toDomain);
  }

  async listAll(): Promise<Template[]> {
    const rows = await this.executor
      .select()
      .from(notificationTemplate)
      .orderBy(
        notificationTemplate.key,
        notificationTemplate.channel,
        notificationTemplate.locale,
        desc(notificationTemplate.version),
      );

    return rows.map(templateMapper.toDomain);
  }

  async findById(id: string): Promise<Template | undefined> {
    const [row] = await this.executor
      .select()
      .from(notificationTemplate)
      .where(eq(notificationTemplate.id, id))
      .limit(1);

    return row && templateMapper.toDomain(row);
  }

  async highestVersion(
    key: string,
    channel: NotificationChannel,
    locale: string,
  ): Promise<number> {
    const [highest] = await this.executor
      .select({ version: max(notificationTemplate.version) })
      .from(notificationTemplate)
      .where(
        and(
          eq(notificationTemplate.key, key),
          eq(notificationTemplate.channel, channel),
          eq(notificationTemplate.locale, locale),
        ),
      );

    return highest?.version ?? 0;
  }

  async create(
    draft: TemplateDraft,
    version: number,
    updatedBy: string,
  ): Promise<string> {
    const [row] = await this.executor
      .insert(notificationTemplate)
      .values({
        ...draft.fields,
        id: randomUUID(),
        status: "draft",
        updatedBy,
        version,
      })
      .onConflictDoNothing({
        target: [
          notificationTemplate.key,
          notificationTemplate.channel,
          notificationTemplate.locale,
          notificationTemplate.version,
        ],
      })
      .returning({ id: notificationTemplate.id });

    return row?.id ?? "";
  }

  async updateDraft(
    id: string,
    draft: TemplateDraft,
    updatedBy: string,
    expectedUpdatedAt: Date,
  ): Promise<boolean> {
    const updated = await this.executor
      .update(notificationTemplate)
      .set({
        ...draft.fields,
        updatedBy,
        updatedAt: sql`greatest(date_trunc('milliseconds', clock_timestamp() at time zone 'UTC'), date_trunc('milliseconds', ${notificationTemplate.updatedAt}) + interval '1 millisecond')`,
      })
      .where(
        and(
          eq(notificationTemplate.id, id),
          eq(notificationTemplate.status, "draft"),
          sql`date_trunc('milliseconds', ${notificationTemplate.updatedAt}) = ${expectedUpdatedAt.toISOString()}::timestamp`,
        ),
      )
      .returning({ id: notificationTemplate.id });

    return updated.length > 0;
  }

  async archivePublished(
    key: string,
    channel: NotificationChannel,
    locale: string,
  ): Promise<void> {
    await this.executor
      .update(notificationTemplate)
      .set({ status: "archived" })
      .where(
        and(
          eq(notificationTemplate.key, key),
          eq(notificationTemplate.channel, channel),
          eq(notificationTemplate.locale, locale),
          eq(notificationTemplate.status, "published"),
        ),
      );
  }

  async publish(id: string): Promise<void> {
    await this.executor
      .update(notificationTemplate)
      .set({ status: "published" })
      .where(eq(notificationTemplate.id, id));
  }

  async deleteDraft(id: string): Promise<Template | undefined> {
    const [deleted] = await this.executor
      .delete(notificationTemplate)
      .where(
        and(
          eq(notificationTemplate.id, id),
          eq(notificationTemplate.status, "draft"),
        ),
      )
      .returning();

    return deleted && templateMapper.toDomain(deleted);
  }
}
