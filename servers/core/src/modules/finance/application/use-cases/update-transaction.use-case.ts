import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Account } from "../../domain/entities/account.entity";
import { BudgetItem } from "../../domain/entities/budget-item.entity";
import { Transaction } from "../../domain/entities/transaction.entity";
import {
  ACCOUNT_REPOSITORY,
  type IAccountRepository,
} from "../../domain/repositories/account.repository.interface";
import {
  BUDGET_REPOSITORY,
  type IBudgetRepository,
} from "../../domain/repositories/budget.repository.interface";
import {
  BUDGET_ITEM_REPOSITORY,
  type IBudgetItemRepository,
} from "../../domain/repositories/budget-item.repository.interface";
import {
  type ITransactionRepository,
  TRANSACTION_REPOSITORY,
} from "../../domain/repositories/transaction.repository.interface";
import { UpdateTransactionDto } from "../dtos/update-transaction.dto";

@Injectable()
export class UpdateTransactionUseCase {
  constructor(
    @Inject(TRANSACTION_REPOSITORY)
    private readonly transactionRepository: ITransactionRepository,
    @Inject(ACCOUNT_REPOSITORY)
    private readonly accountRepository: IAccountRepository,
    @Inject(BUDGET_ITEM_REPOSITORY)
    private readonly budgetItemRepository: IBudgetItemRepository,
    @Inject(BUDGET_REPOSITORY)
    private readonly budgetRepository: IBudgetRepository,
  ) {}

  async execute(
    userId: string,
    id: string,
    dto: UpdateTransactionDto,
  ): Promise<Transaction> {
    const existing = await this.transactionRepository.findById(id);

    if (!existing || existing.userId !== userId) {
      throw new NotFoundException("Transaction not found");
    }

    if (dto.accountId && dto.accountId !== existing.accountId) {
      const account = await this.accountRepository.findById(dto.accountId);
      if (!account || account.userId !== userId) {
        throw new NotFoundException("Account not found");
      }
    }

    if (
      dto.budgetItemId !== undefined &&
      dto.budgetItemId !== existing.budgetItemId
    ) {
      if (dto.budgetItemId) {
        const budgetItem = await this.budgetItemRepository.findById(
          dto.budgetItemId,
        );
        if (!budgetItem) {
          throw new NotFoundException("Budget item not found");
        }

        // Verify budget ownership
        const budget = await this.budgetRepository.findById(
          budgetItem.budgetId,
        );
        if (!budget || budget.userId !== userId) {
          throw new ForbiddenException(
            "Budget item does not belong to your budget",
          );
        }
      }
    }

    const updated = new Transaction(
      existing.id,
      dto.amount ?? existing.amount,
      dto.date ? new Date(dto.date) : existing.date,
      dto.notes !== undefined ? dto.notes : existing.notes,
      dto.currency ?? existing.currency,
      dto.type ?? existing.type,
      dto.files !== undefined ? dto.files : existing.files,
      existing.userId,
      dto.accountId ?? existing.accountId,
      dto.budgetItemId !== undefined ? dto.budgetItemId : existing.budgetItemId,
      existing.deletedAt,
      existing.createdAt,
      new Date(),
      existing.version + 1,
    );

    const updatedTransaction = await this.transactionRepository.update(updated);

    // Update spent for affected budget items
    // If budgetItemId changed, update both old and new
    if (existing.budgetItemId !== updatedTransaction.budgetItemId) {
      if (existing.budgetItemId) {
        await this.recalculateSpent(existing.budgetItemId);
      }
      if (updatedTransaction.budgetItemId) {
        await this.recalculateSpent(updatedTransaction.budgetItemId);
      }
    } else if (updatedTransaction.budgetItemId && dto.amount !== undefined) {
      // If budgetItemId didn't change but amount did, update spent
      await this.recalculateSpent(updatedTransaction.budgetItemId);
    }

    // Update account balances for affected accounts
    if (existing.accountId !== updatedTransaction.accountId) {
      // Account changed: reverse from old account, add to new account
      await this.updateAccountBalance(
        existing.accountId,
        existing.amount,
        existing.type,
        false, // isAdd = false (remove from old account)
      );
      await this.updateAccountBalance(
        updatedTransaction.accountId,
        updatedTransaction.amount,
        updatedTransaction.type,
        true, // isAdd = true (add to new account)
      );
    } else if (dto.amount !== undefined || dto.type !== undefined) {
      // Amount or type changed: reverse old transaction, add new transaction
      await this.updateAccountBalance(
        existing.accountId,
        existing.amount,
        existing.type,
        false, // isAdd = false (reverse old)
      );
      await this.updateAccountBalance(
        updatedTransaction.accountId,
        updatedTransaction.amount,
        updatedTransaction.type,
        true, // isAdd = true (add new)
      );
    }

    return updatedTransaction;
  }

  private async recalculateSpent(budgetItemId: string): Promise<void> {
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
      );
      await this.budgetItemRepository.update(updated);
    }
  }

  private async updateAccountBalance(
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
      newBalance,
      account.userId,
      account.currency,
      account.notes,
      account.deletedAt,
      account.createdAt,
      new Date(),
      account.version,
    );
    await this.accountRepository.update(updated);
  }
}
