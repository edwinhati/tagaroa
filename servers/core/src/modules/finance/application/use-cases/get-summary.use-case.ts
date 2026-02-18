import { Inject, Injectable } from "@nestjs/common";
import {
  BUDGET_REPOSITORY,
  type IBudgetRepository,
} from "../../domain/repositories/budget.repository.interface";
import {
  type ITransactionRepository,
  TRANSACTION_REPOSITORY,
} from "../../domain/repositories/transaction.repository.interface";
import { TransactionType } from "../../domain/value-objects/transaction-type";
import { GetSummaryDto } from "../dtos/dashboard/get-summary.dto";
import { SummaryResponseDto } from "../dtos/dashboard/summary-response.dto";
import { calculateChange, getPreviousPeriod } from "../utils/period-helpers";

@Injectable()
export class GetSummaryUseCase {
  constructor(
    @Inject(TRANSACTION_REPOSITORY)
    private readonly transactionRepository: ITransactionRepository,
    @Inject(BUDGET_REPOSITORY)
    private readonly budgetRepository: IBudgetRepository,
  ) {}

  async execute(
    userId: string,
    dto: GetSummaryDto,
  ): Promise<SummaryResponseDto> {
    // Default to last 3 months if no dates provided
    const endDate = dto.end_date ? new Date(dto.end_date) : new Date();
    const startDate = dto.start_date
      ? new Date(dto.start_date)
      : new Date(endDate.getFullYear(), endDate.getMonth() - 3, 1);
    const currency = dto.currency || "IDR";

    // Get previous period dates
    const previousPeriod = getPreviousPeriod(startDate, endDate);

    // Fetch transactions for current and previous periods
    const [currentAggregations, previousAggregations] = await Promise.all([
      this.transactionRepository.aggregateByType(userId, {
        startDate,
        endDate,
        currencies: [currency],
      }),
      this.transactionRepository.aggregateByType(userId, {
        startDate: previousPeriod.start,
        endDate: previousPeriod.end,
        currencies: [currency],
      }),
    ]);

    // Calculate current period metrics
    const currentIncome =
      currentAggregations.find((agg) => agg.key === TransactionType.INCOME)
        ?.sum || 0;
    const currentExpenses =
      currentAggregations.find((agg) => agg.key === TransactionType.EXPENSE)
        ?.sum || 0;
    const currentSavings = currentIncome - currentExpenses;

    // Calculate previous period metrics
    const previousIncome =
      previousAggregations.find((agg) => agg.key === TransactionType.INCOME)
        ?.sum || 0;
    const previousExpenses =
      previousAggregations.find((agg) => agg.key === TransactionType.EXPENSE)
        ?.sum || 0;
    const previousSavings = previousIncome - previousExpenses;

    // Get budget for utilization calculation
    const month = endDate.getMonth() + 1;
    const year = endDate.getFullYear();
    const budget = await this.budgetRepository.findByUserIdAndMonthYear(
      userId,
      month,
      year,
    );

    const budgetUtilization = budget
      ? (currentExpenses / Number(budget.amount)) * 100
      : 0;

    return {
      income: {
        amount: currentIncome,
        currency,
      },
      expenses: {
        amount: currentExpenses,
        currency,
      },
      savings: {
        amount: currentSavings,
        currency,
      },
      budget_utilization: budgetUtilization,
      income_comparison: {
        current: currentIncome,
        previous: previousIncome,
        change: calculateChange(previousIncome, currentIncome),
      },
      expense_comparison: {
        current: currentExpenses,
        previous: previousExpenses,
        change: calculateChange(previousExpenses, currentExpenses),
      },
      savings_comparison: {
        current: currentSavings,
        previous: previousSavings,
        change: calculateChange(previousSavings, currentSavings),
      },
      previous_period_start: previousPeriod.start.toISOString().slice(0, 10),
      previous_period_end: previousPeriod.end.toISOString().slice(0, 10),
    };
  }
}
