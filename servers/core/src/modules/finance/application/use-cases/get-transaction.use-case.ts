import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { Account } from "../../domain/entities/account.entity";
import { BudgetItem } from "../../domain/entities/budget-item.entity";
import { Transaction } from "../../domain/entities/transaction.entity";
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

export type TransactionWithRelations = {
  transaction: Transaction;
  account: Account;
  budgetItem: BudgetItem | null;
};

@Injectable()
export class GetTransactionUseCase {
  constructor(
    @Inject(TRANSACTION_REPOSITORY)
    private readonly transactionRepository: ITransactionRepository,
    @Inject(ACCOUNT_REPOSITORY)
    private readonly accountRepository: IAccountRepository,
    @Inject(BUDGET_ITEM_REPOSITORY)
    private readonly budgetItemRepository: IBudgetItemRepository,
  ) {}

  async execute(userId: string, id: string): Promise<TransactionWithRelations> {
    const transaction = await this.transactionRepository.findById(id);

    if (!transaction || transaction.userId !== userId) {
      throw new NotFoundException("Transaction not found");
    }

    // Fetch related entities in parallel
    const [account, budgetItem] = await Promise.all([
      this.accountRepository.findById(transaction.accountId),
      transaction.budgetItemId
        ? this.budgetItemRepository.findById(transaction.budgetItemId)
        : Promise.resolve(null),
    ]);

    if (!account) {
      throw new NotFoundException("Associated account not found");
    }

    return {
      transaction,
      account,
      budgetItem,
    };
  }
}
