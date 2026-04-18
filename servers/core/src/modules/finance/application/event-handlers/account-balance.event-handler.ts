import { Inject, Injectable } from "@nestjs/common";
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

  private async adjustBalance(
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
