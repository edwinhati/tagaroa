import { Inject, Injectable } from "@nestjs/common";
import { Liability } from "../../domain/entities/liability.entity";
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
  type ILiabilityRepository,
  LIABILITY_REPOSITORY,
} from "../../domain/repositories/liability.repository.interface";
import {
  type ITransactionRepository,
  TRANSACTION_REPOSITORY,
} from "../../domain/repositories/transaction.repository.interface";
import type { Currency } from "../../domain/value-objects/currency";
import type { CreateTransactionDto } from "../dtos/create-transaction.dto";
import { TransactionSideEffectsService } from "../services/transaction-side-effects.service";
import { normalizeBudgetItemId } from "../utils/transaction-budget-item.util";
import { normalizeTransactionDate } from "../utils/transaction-date.util";

@Injectable()
export class CreateTransactionUseCase {
  constructor(
    private readonly sideEffectsService: TransactionSideEffectsService,
    @Inject(TRANSACTION_REPOSITORY)
    private readonly transactionRepository: ITransactionRepository,
    @Inject(ACCOUNT_REPOSITORY)
    private readonly accountRepository: IAccountRepository,
    @Inject(BUDGET_ITEM_REPOSITORY)
    private readonly budgetItemRepository: IBudgetItemRepository,
    @Inject(BUDGET_REPOSITORY)
    private readonly budgetRepository: IBudgetRepository,
    @Inject(LIABILITY_REPOSITORY)
    private readonly liabilityRepository: ILiabilityRepository,
  ) {}

  async execute(
    userId: string,
    dto: CreateTransactionDto,
  ): Promise<Transaction> {
    const budgetItemId = normalizeBudgetItemId(dto.budgetItemId);

    const account = await this.accountRepository.findById(dto.accountId);
    if (account?.userId !== userId) {
      throw new AccountNotFoundException(dto.accountId);
    }

    if (budgetItemId) {
      const budgetItem = await this.budgetItemRepository.findById(budgetItemId);
      if (!budgetItem) {
        throw new BudgetItemNotFoundException(budgetItemId);
      }

      // Verify budget ownership
      const budget = await this.budgetRepository.findById(budgetItem.budgetId);
      if (budget?.userId !== userId) {
        throw new TransactionAccessDeniedException();
      }
    }

    // Check if account is a liability and installment is requested
    const isLiabilityAccount = account.isLiability();
    const hasInstallment =
      dto.installment !== undefined && dto.installment !== null;

    if (hasInstallment && !isLiabilityAccount) {
      throw new Error(
        "Installments are only available for liability accounts (credit cards, pay-later)",
      );
    }

    const transaction = new Transaction(
      crypto.randomUUID(),
      dto.amount,
      normalizeTransactionDate(dto.date),
      dto.notes ?? null,
      dto.currency,
      dto.type,
      dto.files ?? null,
      userId,
      dto.accountId,
      budgetItemId ?? null,
      null,
      new Date(),
      new Date(),
      1,
      dto.installment ?? null,
    );

    const createdTransaction =
      await this.transactionRepository.create(transaction);

    // Create liability records if this is an installment transaction
    if (hasInstallment && isLiabilityAccount && dto.installment) {
      await this.createInstallmentLiabilities(
        userId,
        createdTransaction,
        dto.installment,
        account.currency,
      );
    }

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

  private async createInstallmentLiabilities(
    userId: string,
    transaction: Transaction,
    installment: {
      tenure: number;
      interestRate: number;
      monthlyAmount: number;
    },
    currency: string,
  ): Promise<void> {
    // Calculate total amounts
    const principal = transaction.amount;
    const totalAmount = installment.monthlyAmount * installment.tenure;
    const totalInterest = totalAmount - principal;

    // Base name for the liability
    const baseName = transaction.notes ?? "Installment Transaction";

    // Create a liability for each month in the tenure
    const promises: Promise<Liability>[] = [];

    for (let i = 1; i <= installment.tenure; i++) {
      // Calculate due date: transaction date + i months
      const dueAt = new Date(transaction.date);
      dueAt.setMonth(dueAt.getMonth() + i);

      const liabilityName = `${baseName} (Installment ${i}/${installment.tenure})`;

      const liability = new Liability(
        crypto.randomUUID(),
        userId,
        liabilityName,
        "INSTALLMENT",
        installment.monthlyAmount, // Each liability is one monthly payment
        currency as Currency,
        null, // paidAt
        null, // notes
        null, // deletedAt
        new Date(),
        new Date(),
        1,
        transaction.id,
        i, // installmentNumber: 1, 2, 3...N
        principal,
        totalInterest,
        totalAmount,
        null, // remainingMonths - not needed for individual installments
        {
          tenure: installment.tenure,
          interestRate: installment.interestRate,
          monthlyAmount: installment.monthlyAmount,
        },
        dueAt,
      );

      promises.push(this.liabilityRepository.create(liability));
    }

    await Promise.all(promises);
  }
}
