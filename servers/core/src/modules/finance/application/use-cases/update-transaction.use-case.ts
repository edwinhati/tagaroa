import { Inject, Injectable } from "@nestjs/common";
import { Transaction } from "../../domain/entities/transaction.entity";
import { AccountNotFoundException } from "../../domain/exceptions/account.exceptions";
import { BudgetItemNotFoundException } from "../../domain/exceptions/budget.exceptions";
import {
  TransactionAccessDeniedException,
  TransactionNotFoundException,
} from "../../domain/exceptions/transaction.exceptions";
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
import { TransactionSideEffectsService } from "../services/transaction-side-effects.service";

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
    private readonly sideEffectsService: TransactionSideEffectsService,
  ) {}

  async execute(
    userId: string,
    id: string,
    dto: UpdateTransactionDto,
  ): Promise<Transaction> {
    const existing = await this.transactionRepository.findById(id);

    if (!existing) {
      throw new TransactionNotFoundException(id);
    }
    if (existing.userId !== userId) {
      throw new TransactionAccessDeniedException();
    }

    if (dto.accountId && dto.accountId !== existing.accountId) {
      const account = await this.accountRepository.findById(dto.accountId);
      if (!account || account.userId !== userId) {
        throw new AccountNotFoundException(dto.accountId);
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
          throw new BudgetItemNotFoundException(dto.budgetItemId);
        }

        // Verify budget ownership
        const budget = await this.budgetRepository.findById(
          budgetItem.budgetId,
        );
        if (!budget || budget.userId !== userId) {
          throw new TransactionAccessDeniedException();
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
        await this.sideEffectsService.recalculateSpent(existing.budgetItemId);
      }
      if (updatedTransaction.budgetItemId) {
        await this.sideEffectsService.recalculateSpent(
          updatedTransaction.budgetItemId,
        );
      }
    } else if (updatedTransaction.budgetItemId && dto.amount !== undefined) {
      // If budgetItemId didn't change but amount did, update spent
      await this.sideEffectsService.recalculateSpent(
        updatedTransaction.budgetItemId,
      );
    }

    // Update account balances for affected accounts
    if (existing.accountId !== updatedTransaction.accountId) {
      // Account changed: reverse from old account, add to new account
      await this.sideEffectsService.updateAccountBalance(
        existing.accountId,
        existing.amount,
        existing.type,
        false, // isAdd = false (remove from old account)
      );
      await this.sideEffectsService.updateAccountBalance(
        updatedTransaction.accountId,
        updatedTransaction.amount,
        updatedTransaction.type,
        true, // isAdd = true (add to new account)
      );
    } else if (dto.amount !== undefined || dto.type !== undefined) {
      // Amount or type changed: reverse old transaction, add new transaction
      await this.sideEffectsService.updateAccountBalance(
        existing.accountId,
        existing.amount,
        existing.type,
        false, // isAdd = false (reverse old)
      );
      await this.sideEffectsService.updateAccountBalance(
        updatedTransaction.accountId,
        updatedTransaction.amount,
        updatedTransaction.type,
        true, // isAdd = true (add new)
      );
    }

    return updatedTransaction;
  }
}
