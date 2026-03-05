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
import type { UpdateTransactionDto } from "../dtos/update-transaction.dto";
import { TransactionSideEffectsService } from "../services/transaction-side-effects.service";

@Injectable()
export class UpdateTransactionUseCase {
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

    await this.validateAccountChange(userId, dto, existing.accountId);
    await this.validateBudgetItemChange(userId, dto, existing.budgetItemId);

    const updated = new Transaction(
      existing.id,
      dto.amount ?? existing.amount,
      dto.date ? new Date(dto.date) : existing.date,
      dto.notes ?? existing.notes,
      dto.currency ?? existing.currency,
      dto.type ?? existing.type,
      dto.files ?? existing.files,
      existing.userId,
      dto.accountId ?? existing.accountId,
      dto.budgetItemId ?? existing.budgetItemId,
      existing.deletedAt,
      existing.createdAt,
      new Date(),
      existing.version + 1,
    );

    const updatedTransaction = await this.transactionRepository.update(updated);

    await this.applyBudgetSideEffects(existing, updatedTransaction, dto);
    await this.applyAccountSideEffects(existing, updatedTransaction, dto);

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
    dto: UpdateTransactionDto,
    existingBudgetItemId: string | null | undefined,
  ): Promise<void> {
    if (
      dto.budgetItemId === undefined ||
      dto.budgetItemId === existingBudgetItemId
    )
      return;
    if (!dto.budgetItemId) return;

    const budgetItem = await this.budgetItemRepository.findById(
      dto.budgetItemId,
    );
    if (!budgetItem) {
      throw new BudgetItemNotFoundException(dto.budgetItemId);
    }

    const budget = await this.budgetRepository.findById(budgetItem.budgetId);
    if (budget?.userId !== userId) {
      throw new TransactionAccessDeniedException();
    }
  }

  private async applyBudgetSideEffects(
    existing: Transaction,
    updated: Transaction,
    dto: UpdateTransactionDto,
  ): Promise<void> {
    if (existing.budgetItemId !== updated.budgetItemId) {
      if (existing.budgetItemId) {
        await this.sideEffectsService.recalculateSpent(existing.budgetItemId);
      }
      if (updated.budgetItemId) {
        await this.sideEffectsService.recalculateSpent(updated.budgetItemId);
      }
    } else if (updated.budgetItemId && dto.amount !== undefined) {
      await this.sideEffectsService.recalculateSpent(updated.budgetItemId);
    }
  }

  private async applyAccountSideEffects(
    existing: Transaction,
    updated: Transaction,
    dto: UpdateTransactionDto,
  ): Promise<void> {
    if (
      existing.accountId !== updated.accountId ||
      dto.amount !== undefined ||
      dto.type !== undefined
    ) {
      await this.sideEffectsService.updateAccountBalance(
        existing.accountId,
        existing.amount,
        existing.type,
        false,
      );
      await this.sideEffectsService.updateAccountBalance(
        updated.accountId,
        updated.amount,
        updated.type,
        true,
      );
    }
  }
}
