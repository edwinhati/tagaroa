import type { Template } from "../entities/template.entity";
import type { NotificationChannel } from "../value-objects/notification-channel.vo";
import type { TemplateDraft } from "../value-objects/template-draft.vo";

export const TEMPLATE_REPOSITORY = Symbol("TEMPLATE_REPOSITORY");

export interface TemplateRepository {
  /**
   * The published wording for any of the locales named, in no particular order.
   * The caller picks between them, because "the caller's language, else the
   * default" is a rule and not a query.
   */
  publishedFor(
    key: string,
    channel: NotificationChannel,
    locales: readonly string[],
  ): Promise<Template[]>;

  /** Every version of every template, key then channel then locale then newest. */
  listAll(): Promise<Template[]>;

  findById(id: string): Promise<Template | undefined>;

  /** The highest version this wording has reached, or 0. */
  highestVersion(
    key: string,
    channel: NotificationChannel,
    locale: string,
  ): Promise<number>;

  create(
    draft: TemplateDraft,
    version: number,
    updatedBy: string,
  ): Promise<string>;

  /** False when the draft is missing or changed since it was read. */
  updateDraft(
    id: string,
    draft: TemplateDraft,
    updatedBy: string,
    expectedUpdatedAt: Date,
  ): Promise<boolean>;

  /** Retire whichever version of this wording is published. */
  archivePublished(
    key: string,
    channel: NotificationChannel,
    locale: string,
  ): Promise<void>;

  publish(id: string): Promise<void>;

  /** False when there is no draft with that id to remove. */
  deleteDraft(id: string): Promise<boolean>;
}
