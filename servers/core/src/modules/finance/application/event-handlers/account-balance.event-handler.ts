import { Inject, Injectable, Logger } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { ConcurrentModificationException } from "../../../../shared/exceptions/domain.exception";
import type { TransactionCreatedEvent } from "../../domain/events/transaction-created.event";
import type { TransactionDeletedEvent } from "../../domain/events/transaction-deleted.event";
import type { TransactionUpdatedEvent } from "../../domain/events/transaction-updated.event";
import type { IAccountRepository } from "../../domain/repositories/account.repository.interface";
import { ACCOUNT_REPOSITORY } from "../../domain/repositories/account.repository.interface";
import { TransactionType } from "../../domain/value-objects/transaction-type";

@Injectable()
export class AccountBalanceEventHandler {
  private readonly logger = new Logger(AccountBalanceEventHandler.name);

  // Serializes balance updates per account to prevent concurrent version conflicts.
  // Each account ID maps to the tail of its pending update chain.
  private readonly accountLocks = new Map<string, Promise<void>>();

  constructor(
    @Inject(ACCOUNT_REPOSITORY)
    private readonly accountRepo: IAccountRepository,
  ) {}

  @OnEvent("transaction.created")
  async handleCreated(event: TransactionCreatedEvent): Promise<void> {
    try {
      await this.adjustBalance(event.accountId, event.amount, event.type, true);
    } catch (error) {
      this.logger.error(
        `Failed to handle transaction.created for account ${event.accountId}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  @OnEvent("transaction.updated")
  async handleUpdated(event: TransactionUpdatedEvent): Promise<void> {
    try {
      // Reverse old effect
      await this.adjustBalance(
        event.previousAccountId,
        event.previousAmount,
        event.previousType,
        false,
      );
      // Apply new effect (only if account changed or amount/type changed)
      if (
        event.previousAccountId !== event.newAccountId ||
        event.previousAmount !== event.newAmount ||
        event.previousType !== event.newType
      ) {
        await this.adjustBalance(
          event.newAccountId,
          event.newAmount,
          event.newType,
          true,
        );
      }
    } catch (error) {
      this.logger.error(
        `Failed to handle transaction.updated`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  @OnEvent("transaction.deleted")
  async handleDeleted(event: TransactionDeletedEvent): Promise<void> {
    try {
      await this.adjustBalance(
        event.accountId,
        event.amount,
        event.type,
        false,
      );
    } catch (error) {
      this.logger.error(
        `Failed to handle transaction.deleted for account ${event.accountId}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  private adjustBalance(
    accountId: string,
    amount: number,
    type: TransactionType,
    isAdd: boolean,
  ): Promise<void> {
    // Chain the new update behind any in-flight update for this account.
    // This ensures sequential execution locally, while the retry loop inside doAdjustBalance
    // handles cross-pod concurrency conflicts.
    const previous = this.accountLocks.get(accountId) ?? Promise.resolve();

    const next = previous.then(() =>
      this.doAdjustBalance(accountId, amount, type, isAdd),
    );

    // Store the chained promise (suppress unhandled rejection on the chain tail)
    const nextWithCatch = next.catch(() => {});
    this.accountLocks.set(accountId, nextWithCatch);

    // Clean up the map once the chain is idle to avoid memory leaks
    next.finally(() => {
      if (this.accountLocks.get(accountId) === nextWithCatch) {
        this.accountLocks.delete(accountId);
      }
    });

    return next;
  }

  private async doAdjustBalance(
    accountId: string,
    amount: number,
    type: TransactionType,
    isAdd: boolean,
    retries = 3,
  ): Promise<void> {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const account = await this.accountRepo.findById(accountId);
        if (!account) return;

        const effectiveAmount = type === "INCOME" ? amount : -amount;
        const newBalance =
          account.balance + (isAdd ? effectiveAmount : -effectiveAmount);

        const updated = account.withUpdatedBalance(newBalance);
        await this.accountRepo.update(updated);
        return; // Success, break loop
      } catch (error) {
        if (
          error instanceof ConcurrentModificationException &&
          attempt < retries
        ) {
          // Add randomized jitter to avoid identical collision patterns
          const jitter = Math.random() * 50 * attempt;
          await new Promise((resolve) => setTimeout(resolve, jitter));
          continue;
        }
        throw error;
      }
    }
  }
}
