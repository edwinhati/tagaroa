import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { type Collection } from "@repo/contracts";
import {
  type TemplateRow,
  NOTIFICATION_CHANNELS,
  TEMPLATE_STATUSES,
} from "@repo/contracts/notifications";

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
  NOTIFICATION_UNIT_OF_WORK,
  type NotificationUnitOfWork,
} from "../../domain/repositories/notification.unit-of-work";
import {
  TEMPLATE_REPOSITORY,
  type TemplateRepository,
} from "../../domain/repositories/template.repository";
import {
  TemplateDraft,
  type TemplateDraftProps,
} from "../../domain/value-objects/template-draft.vo";

/**
 * Which wording an audit event is about. Never the subject or the body: the
 * trail records that the text changed, and the template table holds the text.
 */
const templateDetail = (template: {
  channel: string;
  key: string;
  locale: string;
  version: number;
}): string =>
  `${template.key}:${template.channel}:${template.locale}:v${template.version}`;

/**
 * The wording, listed for the admin app.
 *
 * Filtered and paged in memory rather than in SQL, because the default ordering
 * is compound — key, then channel, then locale, then newest version — and the
 * list is small enough that the whole of it is one round trip. The message log,
 * which is not small, is paged in the database instead.
 */
@Injectable()
export class ListTemplatesUseCase {
  constructor(
    @Inject(TEMPLATE_REPOSITORY)
    private readonly templates: TemplateRepository,
  ) {}

  async execute(
    rawQuery: QueryRecord,
    path: string,
  ): Promise<Collection<TemplateRow>> {
    const templates = await this.templates.listAll();
    const rows: TemplateRow[] = templates.map((template) => ({
      body: template.body,
      channel: template.channel,
      id: template.id,
      key: template.key,
      locale: template.locale,
      secrets: template.secrets,
      status: template.status,
      subject: template.subject,
      updatedAt: template.updatedAt,
      variables: template.variables,
      version: template.version,
    }));

    const query = parseCollectionQuery(rawQuery, {
      filters: ["channel", "status"],
      filterValues: {
        channel: NOTIFICATION_CHANNELS,
        status: TEMPLATE_STATUSES,
      },
      sortable: ["key", "channel", "locale", "version", "updatedAt"],
    });

    const filtered = rows.filter(
      (row) =>
        (query.filters.channel!.length === 0 ||
          query.filters.channel!.includes(row.channel)) &&
        (query.filters.status!.length === 0 ||
          query.filters.status!.includes(row.status)) &&
        (!query.search ||
          `${row.key} ${row.subject ?? ""}`
            .toLocaleLowerCase()
            .includes(query.search.toLocaleLowerCase())),
    );

    return pageCollection(filtered, query, { path, rawQuery });
  }
}

/** A new draft, numbered after the highest version this wording has reached. */
@Injectable()
export class CreateTemplateUseCase {
  constructor(
    @Inject(TEMPLATE_REPOSITORY)
    private readonly templates: TemplateRepository,
    @Inject(AUDIT_TRAIL) private readonly audit: AuditTrail,
  ) {}

  async execute(
    input: TemplateDraftProps,
    authorId: string,
  ): Promise<{ id: string; version: number }> {
    const draft = TemplateDraft.create(input);
    const version =
      (await this.templates.highestVersion(
        draft.key,
        draft.channel,
        draft.locale,
      )) + 1;

    const id = await this.templates.create(draft, version, authorId);
    if (!id)
      throw new ConflictException(
        "Another draft was saved at the same time. Try saving again.",
      );

    await this.audit.record({
      actorId: authorId,
      detail: templateDetail({
        channel: draft.channel,
        key: draft.key,
        locale: draft.locale,
        version,
      }),
      type: "notification.template.created",
    });
    return { id, version };
  }
}

/** Only a draft may be edited; a published version is history. */
@Injectable()
export class EditTemplateUseCase {
  constructor(
    @Inject(TEMPLATE_REPOSITORY)
    private readonly templates: TemplateRepository,
    @Inject(AUDIT_TRAIL) private readonly audit: AuditTrail,
  ) {}

  async execute(
    id: string,
    input: TemplateDraftProps,
    expectedUpdatedAt: Date,
    authorId: string,
  ): Promise<void> {
    const draft = TemplateDraft.create(input);
    const edited = await this.templates.updateDraft(
      id,
      draft,
      authorId,
      expectedUpdatedAt,
    );

    if (!edited) {
      const current = await this.templates.findById(id);
      if (!current || current.status !== "draft")
        throw new NotFoundException("No draft with that id");
      throw new ConflictException(
        "This draft changed in another editor. Copy your changes, then reopen the draft.",
      );
    }

    const saved = await this.templates.findById(id);
    await this.audit.record({
      actorId: authorId,
      detail: saved && templateDetail(saved),
      type: "notification.template.edited",
    });
  }
}

/**
 * Publishing retires whichever version was published before it, in one
 * transaction: the unique index allows a single published row per key, channel
 * and locale, so the two writes cannot be separated.
 */
@Injectable()
export class PublishTemplateUseCase {
  constructor(
    @Inject(NOTIFICATION_UNIT_OF_WORK)
    private readonly unitOfWork: NotificationUnitOfWork,
    @Inject(AUDIT_TRAIL) private readonly audit: AuditTrail,
  ) {}

  async execute(id: string, actorId: string): Promise<void> {
    const draft = await this.unitOfWork.transaction(async ({ templates }) => {
      const draft = await templates.findById(id);
      if (!draft) throw new NotFoundException("No template with that id");

      await templates.archivePublished(draft.key, draft.channel, draft.locale);
      await templates.publish(id);
      return draft;
    });

    // Publishing replaces the text every recipient of this key receives.
    await this.audit.record({
      actorId,
      detail: templateDetail(draft),
      type: "notification.template.published",
    });
  }
}

@Injectable()
export class DeleteTemplateUseCase {
  constructor(
    @Inject(TEMPLATE_REPOSITORY)
    private readonly templates: TemplateRepository,
    @Inject(AUDIT_TRAIL) private readonly audit: AuditTrail,
  ) {}

  async execute(id: string, actorId: string): Promise<void> {
    const deleted = await this.templates.deleteDraft(id);
    if (!deleted) throw new NotFoundException("No draft with that id");

    await this.audit.record({
      actorId,
      detail: templateDetail(deleted),
      type: "notification.template.deleted",
    });
  }
}
