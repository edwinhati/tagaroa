import { Inject, Injectable } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import type { TransactionCreatedEvent } from "../../domain/events/transaction-created.event";
import type { TransactionDeletedEvent } from "../../domain/events/transaction-deleted.event";
import type { TransactionUpdatedEvent } from "../../domain/events/transaction-updated.event";
import type { IBudgetItemRepository } from "../../domain/repositories/budget-item.repository.interface";
import { BUDGET_ITEM_REPOSITORY } from "../../domain/repositories/budget-item.repository.interface";
import type { ITransactionRepository } from "../../domain/repositories/transaction.repository.interface";
import { TRANSACTION_REPOSITORY } from "../../domain/repositories/transaction.repository.interface";

@Injectable()
export class BudgetItemSpentEventHandler {
  constructor(
    @Inject(BUDGET_ITEM_REPOSITORY)
    private readonly budgetItemRepo: IBudgetItemRepository,
    @Inject(TRANSACTION_REPOSITORY)
    private readonly transactionRepo: ITransactionRepository,
  ) {}

  @OnEvent("transaction.created")
  async handleCreated(event: TransactionCreatedEvent): Promise<void> {
    await this.recalculateSpentIfPresent(event.budgetItemId);
  }

  @OnEvent("transaction.updated")
  async handleUpdated(event: TransactionUpdatedEvent): Promise<void> {
    // Recalculate old budget item if changed
    if (
      event.previousBudgetItemId &&
      event.previousBudgetItemId !== event.newBudgetItemId
    ) {
      await this.recalculateSpent(event.previousBudgetItemId);
    }
    // Recalculate new budget item
    await this.recalculateSpentIfPresent(event.newBudgetItemId);
  }

  @OnEvent("transaction.deleted")
  async handleDeleted(event: TransactionDeletedEvent): Promise<void> {
    await this.recalculateSpentIfPresent(event.budgetItemId);
  }

  private async recalculateSpentIfPresent(
    budgetItemId: string | undefined | null,
  ): Promise<void> {
    if (budgetItemId) {
      await this.recalculateSpent(budgetItemId);
    }
  }

  private async recalculateSpent(budgetItemId: string): Promise<void> {
    const transactions =
      await this.transactionRepo.findByBudgetItemId(budgetItemId);
    const spent = transactions.reduce((sum, t) => sum + t.amount, 0);
    const budgetItem = await this.budgetItemRepo.findById(budgetItemId);
    if (budgetItem) {
      await this.budgetItemRepo.update(budgetItem.withUpdatedSpent(spent));
    }
  }
}
