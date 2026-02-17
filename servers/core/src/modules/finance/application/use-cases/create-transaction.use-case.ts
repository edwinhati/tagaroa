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
import { CreateTransactionDto } from "../dtos/create-transaction.dto";

@Injectable()
export class CreateTransactionUseCase {
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
    dto: CreateTransactionDto,
  ): Promise<Transaction> {
    const account = await this.accountRepository.findById(dto.accountId);
    if (!account || account.userId !== userId) {
      throw new NotFoundException("Account not found");
    }

    if (dto.budgetItemId) {
      const budgetItem = await this.budgetItemRepository.findById(
        dto.budgetItemId,
      );
      if (!budgetItem) {
        throw new NotFoundException("Budget item not found");
      }

      // Verify budget ownership
      const budget = await this.budgetRepository.findById(budgetItem.budgetId);
      if (!budget || budget.userId !== userId) {
        throw new ForbiddenException(
          "Budget item does not belong to your budget",
        );
      }
    }

    const transaction = new Transaction(
      crypto.randomUUID(),
      dto.amount,
      new Date(dto.date),
      dto.notes ?? null,
      dto.currency,
      dto.type,
      dto.files ?? null,
      userId,
      dto.accountId,
      dto.budgetItemId ?? null,
      null,
      new Date(),
      new Date(),
      1,
    );

    const createdTransaction =
      await this.transactionRepository.create(transaction);

    // Update budget item spent field
    if (createdTransaction.budgetItemId) {
      await this.recalculateSpent(createdTransaction.budgetItemId);
    }

    // Update account balance (add transaction)
    await this.updateAccountBalance(
      createdTransaction.accountId,
      createdTransaction.amount,
      createdTransaction.type,
      true, // isAdd = true
    );

    return createdTransaction;
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
