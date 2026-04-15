import { Inject, Injectable } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { Liability } from "../../domain/entities/liability.entity";
import { Transaction } from "../../domain/entities/transaction.entity";
import { TransactionCreatedEvent } from "../../domain/events/transaction-created.event";
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
import { normalizeBudgetItemId } from "../utils/transaction-budget-item.util";
import { normalizeTransactionDate } from "../utils/transaction-date.util";

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
    @Inject(LIABILITY_REPOSITORY)
    private readonly liabilityRepository: ILiabilityRepository,
    private readonly eventEmitter: EventEmitter2,
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

      const budget = await this.budgetRepository.findById(budgetItem.budgetId);
      if (budget?.userId !== userId) {
        throw new TransactionAccessDeniedException();
      }
    }

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

    if (hasInstallment && isLiabilityAccount && dto.installment) {
      await this.createInstallmentLiabilities(
        userId,
        createdTransaction,
        dto.installment,
        account.currency,
      );
    }

    this.eventEmitter.emit(
      "transaction.created",
      new TransactionCreatedEvent(
        createdTransaction.id,
        userId,
        createdTransaction.accountId,
        createdTransaction.budgetItemId,
        createdTransaction.amount,
        createdTransaction.type,
        createdTransaction.currency,
        createdTransaction.installment,
      ),
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
    const principal = transaction.amount;
    const totalAmount = installment.monthlyAmount * installment.tenure;
    const totalInterest = totalAmount - principal;

    const baseName = transaction.notes ?? "Installment Transaction";

    const promises: Promise<Liability>[] = [];

    for (let i = 1; i <= installment.tenure; i++) {
      const dueAt = new Date(transaction.date);
      dueAt.setMonth(dueAt.getMonth() + i);

      const liabilityName = `${baseName} (Installment ${i}/${installment.tenure})`;

      const liability = new Liability(
        crypto.randomUUID(),
        userId,
        liabilityName,
        "INSTALLMENT",
        installment.monthlyAmount,
        currency as Currency,
        null,
        null,
        null,
        new Date(),
        new Date(),
        1,
        transaction.id,
        i,
        principal,
        totalInterest,
        totalAmount,
        null,
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
