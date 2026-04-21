import { Inject, Injectable } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { Transaction } from "../../domain/entities/transaction.entity";
import { TransactionUpdatedEvent } from "../../domain/events/transaction-updated.event";
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
import type { UpdateTransactionDto } from "../dtos/update-transaction.dto";
import { UnitOfWork } from "../services/unit-of-work.service";
import { normalizeTransactionDate } from "../utils/transaction-date.util";

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
    private readonly eventEmitter: EventEmitter2,
    private readonly unitOfWork: UnitOfWork,
  ) {}

  async execute(
    userId: string,
    id: string,
    dto: UpdateTransactionDto,
  ): Promise<Transaction> {
    const { updatedTransaction, existing } = await this.unitOfWork.execute(
      async () => {
        const existing = await this.transactionRepository.findById(id);

        if (!existing) {
          throw new TransactionNotFoundException(id);
        }
        if (existing.userId !== userId) {
          throw new TransactionAccessDeniedException();
        }

        await this.validateAccountChange(userId, dto, existing.accountId);
        await this.validateBudgetItemChange(
          userId,
          dto.budgetItemId,
          existing.budgetItemId,
        );

        const updated = new Transaction(
          existing.id,
          dto.amount ?? existing.amount,
          dto.date ? normalizeTransactionDate(dto.date) : existing.date,
          dto.notes ?? existing.notes,
          dto.currency ?? existing.currency,
          dto.type ?? existing.type,
          dto.files ?? existing.files,
          existing.userId,
          dto.accountId ?? existing.accountId,
          dto.budgetItemId !== undefined
            ? dto.budgetItemId
            : existing.budgetItemId,
          existing.deletedAt,
          existing.createdAt,
          new Date(),
          existing.version + 1,
        );

        const updatedTransaction =
          await this.transactionRepository.update(updated);

        return { updatedTransaction, existing };
      },
    );

    // Emit AFTER the transaction has committed so the event handler
    // reads the committed account row (correct version number).
    this.eventEmitter.emit(
      "transaction.updated",
      new TransactionUpdatedEvent(
        updatedTransaction.id,
        userId,
        existing.accountId,
        existing.budgetItemId,
        existing.amount,
        existing.type,
        updatedTransaction.accountId,
        updatedTransaction.budgetItemId,
        updatedTransaction.amount,
        updatedTransaction.type,
      ),
    );

    return updatedTransaction;
  }

  private async validateAccountChange(
    userId: string,
    dto: UpdateTransactionDto,
    existingAccountId: string,
  ): Promise<void> {
    if (!dto.accountId || dto.accountId === existingAccountId) return;

    const account = await this.accountRepository.findById(dto.accountId);
    if (account?.userId !== userId) {
      throw new AccountNotFoundException(dto.accountId);
    }
  }

  private async validateBudgetItemChange(
    userId: string,
    budgetItemId: string | null | undefined,
    existingBudgetItemId: string | null | undefined,
  ): Promise<void> {
    if (budgetItemId === undefined || budgetItemId === existingBudgetItemId)
      return;
    if (!budgetItemId) return; // null or empty (though DTO handles empty)

    const budgetItem = await this.budgetItemRepository.findById(budgetItemId);
    if (!budgetItem) {
      throw new BudgetItemNotFoundException(budgetItemId);
    }

    const budget = await this.budgetRepository.findById(budgetItem.budgetId);
    if (budget?.userId !== userId) {
      throw new TransactionAccessDeniedException();
    }
  }
}
