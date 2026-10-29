import { Inject, Injectable } from "@nestjs/common";

import {
  DATABASE,
  type Database,
} from "../../../../../platform/database/database.module";
import type {
  NotificationRepositories,
  NotificationUnitOfWork,
} from "../../../domain/repositories/notification.unit-of-work";
import { DrizzleMessageRepository } from "./drizzle-message.repository";
import { DrizzleSuppressionRepository } from "./drizzle-suppression.repository";
import { DrizzleTemplateRepository } from "./drizzle-template.repository";
import type { Executor } from "./notification.executor";

/**
 * `BEGIN`, and the only thing in the module that says so.
 *
 * The three repositories are rebuilt against the open transaction rather than
 * injected, which is what makes them the same classes the module binds outside
 * one — a second "transactional" implementation of each would be three more
 * places for the SQL to drift.
 *
 * Drizzle's transaction handle carries the same query builders as the database
 * it came from without sharing its type, and its generics cannot see through a
 * union of the two. So the cast happens once, here, at the one point where the
 * two are known to be interchangeable.
 */
@Injectable()
export class DrizzleNotificationUnitOfWork implements NotificationUnitOfWork {
  constructor(@Inject(DATABASE) private readonly database: Database) {}

  async transaction<T>(
    work: (repositories: NotificationRepositories) => Promise<T>,
  ): Promise<T> {
    return this.database.transaction(async (transaction) => {
      const executor = transaction as unknown as Executor;

      return work({
        messages: new DrizzleMessageRepository(executor),
        suppressions: new DrizzleSuppressionRepository(executor),
        templates: new DrizzleTemplateRepository(executor),
      });
    });
  }
}
