import { Inject, Injectable, Logger } from "@nestjs/common";

import { Message } from "../../domain/entities/message.entity";
import type { EnqueuedMessage } from "../../domain/repositories/message.repository";
import {
  NOTIFICATION_UNIT_OF_WORK,
  type NotificationRepositories,
  type NotificationUnitOfWork,
} from "../../domain/repositories/notification.unit-of-work";
import type { NotificationChannel } from "../../domain/value-objects/notification-channel.vo";
import {
  WORDING_OPTIONS,
  type WordingOptions,
} from "../../infrastructure/config/notification.options";

export interface SendInput {
  /** The template key, e.g. `account.issued`. */
  key: string;
  channel: NotificationChannel;
  /** An address or an E.164 number. The caller owns the recipient, not us. */
  to: string;
  locale?: string;
  variables?: Record<string, string>;
  /**
   * The caller's own name for this send. A second call carrying the same key
   * returns the first message instead of sending twice, which is what makes a
   * retried request safe.
   */
  idempotencyKey?: string;
}

/**
 * Enqueueing a message, and nothing else.
 *
 * The whole act is one transaction, opened through the unit of work: a message
 * exists exactly when the thing that caused it does — no publish that can
 * succeed while the transaction rolls back, and no transaction that commits
 * while the publish fails. Delivery is the dispatcher's job, on its own
 * schedule.
 */
@Injectable()
export class SendNotificationUseCase {
  private readonly logger = new Logger(SendNotificationUseCase.name);

  constructor(
    @Inject(NOTIFICATION_UNIT_OF_WORK)
    private readonly unitOfWork: NotificationUnitOfWork,
    @Inject(WORDING_OPTIONS) private readonly options: WordingOptions,
  ) {}

  async execute(input: SendInput): Promise<EnqueuedMessage> {
    const locale = input.locale ?? this.options.defaultLocale;

    return this.unitOfWork.transaction(async (repositories) => {
      const suppressedReason =
        (await repositories.suppressions.reasonFor(input.channel, input.to)) ??
        null;

      const template = await this.wording(repositories, input, locale);

      // Two halves: what is safe to keep, and what only the carrier may see.
      const rendered = template.render(input.variables ?? {});

      const message = Message.enqueue({
        channel: input.channel,
        destination: input.to,
        idempotencyKey: input.idempotencyKey ?? null,
        key: input.key,
        locale: template.locale,
        payload: rendered.payload,
        secrets: rendered.secrets,
        suppressedReason,
        templateId: template.id,
      });

      const enqueued = await repositories.messages.enqueue(message);
      if (enqueued) return enqueued;

      // The conflict means this exact send already happened.
      const existing = await repositories.messages.findByIdempotencyKey(
        input.idempotencyKey ?? "",
      );

      if (!existing) {
        throw new Error(`Could not enqueue ${input.key} for ${input.channel}`);
      }
      this.logger.debug(`Reusing ${existing.id} for ${input.idempotencyKey}`);
      return existing;
    });
  }

  /**
   * The published wording for the caller's locale, or the default locale's when
   * that language has none. A missing template throws rather than sending
   * something improvised.
   */
  private async wording(
    repositories: NotificationRepositories,
    input: SendInput,
    locale: string,
  ) {
    const locales = [...new Set([locale, this.options.defaultLocale])];
    const candidates = await repositories.templates.publishedFor(
      input.key,
      input.channel,
      locales,
    );

    const wording =
      candidates.find((row) => row.locale === locale) ??
      candidates.find((row) => row.locale === this.options.defaultLocale);

    if (!wording) {
      throw new Error(
        `No published ${input.channel} template for "${input.key}" in ${locales.join(" or ")}`,
      );
    }
    return wording;
  }
}
