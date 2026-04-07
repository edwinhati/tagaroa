import { Inject, Injectable } from "@nestjs/common";
import { Account } from "../../domain/entities/account.entity";
import { BudgetItem } from "../../domain/entities/budget-item.entity";
import {
  ACCOUNT_REPOSITORY,
  type IAccountRepository,
} from "../../domain/repositories/account.repository.interface";
import {
  BUDGET_ITEM_REPOSITORY,
  type IBudgetItemRepository,
} from "../../domain/repositories/budget-item.repository.interface";
import {
  type ITransactionRepository,
  TRANSACTION_REPOSITORY,
} from "../../domain/repositories/transaction.repository.interface";

@Injectable()
export class TransactionSideEffectsService {
  @Inject(ACCOUNT_REPOSITORY)
  private readonly accountRepository!: IAccountRepository;
  @Inject(BUDGET_ITEM_REPOSITORY)
  private readonly budgetItemRepository!: IBudgetItemRepository;
  @Inject(TRANSACTION_REPOSITORY)
  private readonly transactionRepository!: ITransactionRepository;

  async recalculateSpent(budgetItemId: string): Promise<void> {
    const transactions =
      await this.transactionRepository.findByBudgetItemId(budgetItemId);
    const spent = transactions.reduce((sum, t) => sum + t.amount, 0);

    const budgetItem = await this.budgetItemRepository.findById(budgetItemId);
    if (budgetItem) {
      const updated = new BudgetItem(
        budgetItem.id,
        budgetItem.budgetId,
        budgetItem.category,
        budgetItem.allocation,
        spent,
        budgetItem.deletedAt,
        budgetItem.createdAt,
        new Date(),
        budgetItem.version + 1,
      );
      await this.budgetItemRepository.update(updated);
    }
  }

  async updateAccountBalance(
    accountId: string,
    amount: number,
    type: string,
    isAdd: boolean,
  ): Promise<void> {
    const account = await this.accountRepository.findById(accountId);
    if (!account) return;

    let newBalance = account.balance;

    if (isAdd) {
      // Adding a transaction: INCOME increases, EXPENSE decreases
      newBalance =
        type === "INCOME" ? newBalance + amount : newBalance - amount;
    } else {
      // Removing a transaction: reverse the operation
      newBalance =
        type === "INCOME" ? newBalance - amount : newBalance + amount;
    }

    const updated = new Account(
      account.id,
      account.name,
      account.type,
      account.category,
      newBalance,
      account.userId,
      account.currency,
      account.notes,
      account.metadata,
      account.deletedAt,
      account.createdAt,
      new Date(),
      account.version,
    );
    await this.accountRepository.update(updated);
  }
}
