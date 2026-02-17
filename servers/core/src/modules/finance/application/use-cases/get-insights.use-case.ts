import { Inject, Injectable } from "@nestjs/common";
import {
  type ITransactionRepository,
  TRANSACTION_REPOSITORY,
} from "../../domain/repositories/transaction.repository.interface";
import { TransactionType } from "../../domain/value-objects/transaction-type";
import { GetInsightsDto } from "../dtos/dashboard/get-insights.dto";
import {
  InsightItemDto,
  InsightsResponseDto,
} from "../dtos/dashboard/insights-response.dto";
import { calculateChange, getPreviousPeriod } from "../utils/period-helpers";

@Injectable()
export class GetInsightsUseCase {
  constructor(
    @Inject(TRANSACTION_REPOSITORY)
    private readonly transactionRepository: ITransactionRepository,
  ) {}

  async execute(
    userId: string,
    dto: GetInsightsDto,
  ): Promise<InsightsResponseDto> {
    const startDate = new Date(dto.start_date);
    const endDate = new Date(dto.end_date);

    // Get previous period for trend calculation
    const previousPeriod = getPreviousPeriod(startDate, endDate);

    // Fetch current and previous period aggregations
    const [currentTypeAgg, previousTypeAgg] = await Promise.all([
      this.transactionRepository.aggregateByType(userId, {
        startDate,
        endDate,
      }),
      this.transactionRepository.aggregateByType(userId, {
        startDate: previousPeriod.start,
        endDate: previousPeriod.end,
      }),
    ]);

    // Calculate savings rate
    const currentIncome =
      currentTypeAgg.find((agg) => agg.key === TransactionType.INCOME)?.sum ||
      0;
    const currentExpenses =
      currentTypeAgg.find((agg) => agg.key === TransactionType.EXPENSE)?.sum ||
      0;
    const savingsRate =
      currentIncome > 0
        ? ((currentIncome - currentExpenses) / currentIncome) * 100
        : 0;

    // Calculate previous savings rate for trend
    const previousIncome =
      previousTypeAgg.find((agg) => agg.key === TransactionType.INCOME)?.sum ||
      0;
    const previousExpenses =
      previousTypeAgg.find((agg) => agg.key === TransactionType.EXPENSE)?.sum ||
      0;
    const previousSavingsRate =
      previousIncome > 0
        ? ((previousIncome - previousExpenses) / previousIncome) * 100
        : 0;

    // Determine savings rate trend
    let savingsRateTrend: "up" | "down" | "stable" = "stable";
    const trendChange = savingsRate - previousSavingsRate;
    if (trendChange > 1) {
      savingsRateTrend = "up";
    } else if (trendChange < -1) {
      savingsRateTrend = "down";
    }

    // Get top income sources (by account)
    const incomeAccountAgg =
      await this.transactionRepository.aggregateByAccount(userId, {
        startDate,
        endDate,
        types: [TransactionType.INCOME],
      });

    const topIncomeSources: InsightItemDto[] = incomeAccountAgg
      .sort((a, b) => b.sum - a.sum)
      .slice(0, 5)
      .map((agg) => ({
        category: agg.key || "Unknown",
        amount: agg.sum,
        percentage: currentIncome > 0 ? (agg.sum / currentIncome) * 100 : 0,
      }));

    // Get top expenses (by category)
    const expenseCategoryAgg =
      await this.transactionRepository.aggregateByCategory(userId, {
        startDate,
        endDate,
        types: [TransactionType.EXPENSE],
      });

    // aggregateByCategory already returns category names as keys
    const topExpenses: InsightItemDto[] = expenseCategoryAgg
      .sort((a, b) => b.sum - a.sum)
      .slice(0, 5)
      .map((agg) => ({
        category: agg.key || "Uncategorized",
        amount: agg.sum,
        percentage: currentExpenses > 0 ? (agg.sum / currentExpenses) * 100 : 0,
      }));

    // Generate recommendations
    const recommendations: string[] = [];

    // Savings rate recommendation
    if (savingsRate < 10) {
      recommendations.push(
        `Your savings rate is ${savingsRate.toFixed(1)}%, which needs improvement. Aim for at least 20% to build financial security.`,
      );
    } else if (savingsRate < 20) {
      recommendations.push(
        `Your savings rate is ${savingsRate.toFixed(1)}%, which is good. Try to increase it to 20% or more for better financial health.`,
      );
    } else {
      recommendations.push(
        `Excellent! Your savings rate is ${savingsRate.toFixed(1)}%. Keep up the great work!`,
      );
    }

    // Top expense recommendation
    if (topExpenses.length > 0) {
      const topExpense = topExpenses[0];
      if (topExpense) {
        recommendations.push(
          `Your biggest expense is ${topExpense.category} at ${topExpense.percentage.toFixed(1)}% of total spending.`,
        );
      }
    }

    // Period comparison recommendation
    const expenseChange = calculateChange(previousExpenses, currentExpenses);
    if (expenseChange > 10) {
      recommendations.push(
        `You spent ${expenseChange.toFixed(1)}% more this period compared to last period. Consider reviewing your budget.`,
      );
    } else if (expenseChange < -10) {
      recommendations.push(
        `Great job! You reduced spending by ${Math.abs(expenseChange).toFixed(1)}% compared to last period.`,
      );
    }

    // Savings trend recommendation
    if (savingsRateTrend === "up") {
      const savingsIncrease = savingsRate - previousSavingsRate;
      recommendations.push(
        `Your savings rate improved by ${savingsIncrease.toFixed(1)}% compared to last period!`,
      );
    }

    return {
      savings_rate: savingsRate,
      savings_rate_trend: savingsRateTrend,
      top_income_sources: topIncomeSources,
      top_expenses: topExpenses,
      recommendations,
    };
  }
}
