import { Inject, Injectable } from "@nestjs/common";
import { Transaction } from "../../domain/entities/transaction.entity";
import { AccountNotFoundException } from "../../domain/exceptions/account.exceptions";
import { BudgetItemNotFoundException } from "../../domain/exceptions/budget.exceptions";
import { TransactionAccessDeniedException } from "../../domain/exceptions/transaction.exceptions";
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
import type { CreateTransactionDto } from "../dtos/create-transaction.dto";
import { TransactionSideEffectsService } from "../services/transaction-side-effects.service";

@Injectable()
export class CreateTransactionUseCase {
  constructor(
    private readonly sideEffectsService: TransactionSideEffectsService,
  ) {}
  @Inject(TRANSACTION_REPOSITORY)
  private readonly transactionRepository!: ITransactionRepository;
  @Inject(ACCOUNT_REPOSITORY)
  private readonly accountRepository!: IAccountRepository;
  @Inject(BUDGET_ITEM_REPOSITORY)
  private readonly budgetItemRepository!: IBudgetItemRepository;
  @Inject(BUDGET_REPOSITORY)
  private readonly budgetRepository!: IBudgetRepository;

  async execute(
    userId: string,
    dto: CreateTransactionDto,
  ): Promise<Transaction> {
    const account = await this.accountRepository.findById(dto.accountId);
    if (!account) {
      throw new AccountNotFoundException(dto.accountId);
    }
    if (account.userId !== userId) {
      throw new AccountNotFoundException(dto.accountId);
    }

    if (dto.budgetItemId) {
      const budgetItem = await this.budgetItemRepository.findById(
        dto.budgetItemId,
      );
      if (!budgetItem) {
        throw new BudgetItemNotFoundException(dto.budgetItemId);
      }

      // Verify budget ownership
      const budget = await this.budgetRepository.findById(budgetItem.budgetId);
      if (!budget || budget.userId !== userId) {
        throw new TransactionAccessDeniedException();
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
      await this.sideEffectsService.recalculateSpent(
        createdTransaction.budgetItemId,
      );
    }

    // Update account balance (add transaction)
    await this.sideEffectsService.updateAccountBalance(
      createdTransaction.accountId,
      createdTransaction.amount,
      createdTransaction.type,
      true, // isAdd = true
    );

    return createdTransaction;
  }
}
