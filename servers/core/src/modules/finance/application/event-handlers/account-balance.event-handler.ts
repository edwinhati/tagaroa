import { Inject, Injectable } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import type { TransactionCreatedEvent } from "../../domain/events/transaction-created.event";
import type { TransactionDeletedEvent } from "../../domain/events/transaction-deleted.event";
import type { TransactionUpdatedEvent } from "../../domain/events/transaction-updated.event";
import type { IAccountRepository } from "../../domain/repositories/account.repository.interface";
import { ACCOUNT_REPOSITORY } from "../../domain/repositories/account.repository.interface";
import { TransactionType } from "../../domain/value-objects/transaction-type";

@Injectable()
export class AccountBalanceEventHandler {
  // Serializes balance updates per account to prevent concurrent version conflicts.
  // Each account ID maps to the tail of its pending update chain.
  private readonly accountLocks = new Map<string, Promise<void>>();

  constructor(
    @Inject(ACCOUNT_REPOSITORY)
    private readonly accountRepo: IAccountRepository,
  ) {}

  @OnEvent("transaction.created")
  async handleCreated(event: TransactionCreatedEvent): Promise<void> {
    await this.adjustBalance(event.accountId, event.amount, event.type, true);
  }

  @OnEvent("transaction.updated")
  async handleUpdated(event: TransactionUpdatedEvent): Promise<void> {
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
  }

  @OnEvent("transaction.deleted")
  async handleDeleted(event: TransactionDeletedEvent): Promise<void> {
    await this.adjustBalance(event.accountId, event.amount, event.type, false);
  }

  private adjustBalance(
    accountId: string,
    amount: number,
    type: TransactionType,
    isAdd: boolean,
  ): Promise<void> {
    // Chain the new update behind any in-flight update for this account.
    // This ensures sequential execution and makes version conflicts impossible.
    const previous = this.accountLocks.get(accountId) ?? Promise.resolve();

    const next = previous.then(() =>
      this.doAdjustBalance(accountId, amount, type, isAdd),
    );

    // Store the chained promise (suppress unhandled rejection on the chain tail)
    this.accountLocks.set(
      accountId,
      next.catch(() => {}),
    );

    // Clean up the map once the chain is idle to avoid memory leaks
    next.finally(() => {
      if (this.accountLocks.get(accountId) === next.catch(() => {})) {
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
  ): Promise<void> {
    const account = await this.accountRepo.findById(accountId);
    if (!account) return;

    const effectiveAmount = type === "INCOME" ? amount : -amount;
    const newBalance =
      account.balance + (isAdd ? effectiveAmount : -effectiveAmount);

    const updated = account.withUpdatedBalance(newBalance);
    await this.accountRepo.update(updated);
  }
}
