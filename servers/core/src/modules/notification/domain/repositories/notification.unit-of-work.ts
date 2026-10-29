import type { MessageRepository } from "./message.repository";
import type { SuppressionRepository } from "./suppression.repository";
import type { TemplateRepository } from "./template.repository";

export const NOTIFICATION_UNIT_OF_WORK = Symbol("NOTIFICATION_UNIT_OF_WORK");

export interface NotificationRepositories {
  messages: MessageRepository;
  suppressions: SuppressionRepository;
  templates: TemplateRepository;
}

/**
 * Several tables changed as one act.
 *
 * Enqueueing reads the suppression list and the published wording and then
 * inserts, and all three have to be the same instant: a suppression written
 * between the check and the insert would otherwise produce a queued message to
 * a destination that had just refused. Publishing likewise retires the previous
 * version and promotes the new one under a unique index that permits only one
 * published row.
 *
 * Stated as repositories-within-a-transaction rather than by handing out the
 * driver's transaction object, so the application layer can open one without
 * learning what a `Database` is. The Drizzle adapter is the only thing that
 * knows this is `BEGIN`.
 */
export interface NotificationUnitOfWork {
  transaction<T>(
    work: (repositories: NotificationRepositories) => Promise<T>,
  ): Promise<T>;
}
