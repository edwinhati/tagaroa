import type { Message } from "../../../domain/entities/message.entity";
import { QueuedMessage } from "../../../domain/entities/queued-message.entity";
import type { Suppression } from "../../../domain/entities/suppression.entity";
import { Template } from "../../../domain/entities/template.entity";
import type {
  notificationMessage,
  notificationSuppression,
  notificationTemplate,
} from "./schema";

type MessageRow = typeof notificationMessage.$inferSelect;
type MessageInsert = typeof notificationMessage.$inferInsert;
type TemplateRow = typeof notificationTemplate.$inferSelect;
type SuppressionInsert = typeof notificationSuppression.$inferInsert;

/** The columns a claim reads, which is all a delivery attempt needs. */
export type ClaimedRow = Pick<
  MessageRow,
  | "attempts"
  | "channel"
  | "destination"
  | "id"
  | "locale"
  | "payload"
  | "secrets"
>;

/**
 * Between the rows and the entities.
 *
 * Only the columns the domain has an opinion about travel. `attempts`,
 * `nextAttemptAt` and `lockedAt` are the dispatcher's bookkeeping, set by the
 * statements that claim and release a row rather than carried on an entity: a
 * message that read them, changed them and wrote them back would turn every
 * delivery into a read-modify-write across the window in which another drainer
 * may have claimed it.
 */
export const messageMapper = {
  toPersistence: (message: Message): MessageInsert => ({
    channel: message.channel,
    completedAt: message.completedAt,
    destination: message.destination,
    error: message.error,
    id: message.id,
    idempotencyKey: message.idempotencyKey,
    key: message.key,
    locale: message.locale,
    payload: message.payload,
    secrets: message.secrets,
    status: message.status,
    templateId: message.templateId,
  }),
};

export const queuedMessageMapper = {
  toDomain: (row: ClaimedRow & { claimedAt: Date }): QueuedMessage =>
    QueuedMessage.restore(row),
};

export const templateMapper = {
  toDomain: (row: TemplateRow): Template =>
    Template.restore({
      body: row.body,
      channel: row.channel,
      id: row.id,
      key: row.key,
      locale: row.locale,
      secrets: row.secrets,
      status: row.status,
      subject: row.subject,
      updatedAt: row.updatedAt,
      variables: row.variables,
      version: row.version,
    }),
};

export const suppressionMapper = {
  toPersistence: (suppression: Suppression): SuppressionInsert => ({
    channel: suppression.channel,
    destination: suppression.destination,
    id: suppression.id,
    reason: suppression.reason,
  }),
};
