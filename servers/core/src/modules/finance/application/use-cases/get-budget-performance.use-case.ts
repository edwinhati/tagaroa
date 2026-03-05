import { Inject, Injectable } from "@nestjs/common";
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
import { TransactionType } from "../../domain/value-objects/transaction-type";
import type {
  BudgetPerformanceItemDto,
  BudgetPerformanceResponseDto,
} from "../dtos/dashboard/budget-performance-response.dto";
import type { GetBudgetPerformanceDto } from "../dtos/dashboard/get-budget-performance.dto";

@Injectable()
export class GetBudgetPerformanceUseCase {
  @Inject(BUDGET_REPOSITORY)
  private readonly budgetRepository!: IBudgetRepository;
  @Inject(BUDGET_ITEM_REPOSITORY)
  private readonly budgetItemRepository!: IBudgetItemRepository;
  @Inject(TRANSACTION_REPOSITORY)
  private readonly transactionRepository!: ITransactionRepository;

  async execute(
    userId: string,
    dto: GetBudgetPerformanceDto,
  ): Promise<BudgetPerformanceResponseDto> {
    // Fetch budget for the given month/year
    const budget = await this.budgetRepository.findByUserIdAndMonthYear(
      userId,
      dto.month,
      dto.year,
    );

    // If no budget exists, return empty result
    if (!budget) {
      return {
        month: dto.month,
        year: dto.year,
        items: [],
        total_allocated: 0,
        total_spent: 0,
        total_remaining: 0,
        overall_percentage: 0,
      };
    }

    // Fetch budget items
    const budgetItems = await this.budgetItemRepository.findByBudgetId(
      budget.id,
    );

    // Fetch expense transactions for the budget period (25th of prev month to 25th of current month)
    // Budget periods run from 25th to 25th, and are named after the ending month
    const startDate = new Date(
      dto.month === 1 ? dto.year - 1 : dto.year,
      dto.month === 1 ? 11 : dto.month - 2,
      25,
    );
    const endDate = new Date(dto.year, dto.month - 1, 25);

    const transactionAggregations =
      await this.transactionRepository.aggregateByCategory(userId, {
        startDate,
        endDate,
        types: [TransactionType.EXPENSE],
      });

    // Create a map of category name to spent amount
    // aggregateByCategory returns category names in the 'key' field
    const spentMap = new Map<string, number>();
    for (const agg of transactionAggregations) {
      spentMap.set(agg.key, agg.sum);
    }

    // Build performance items
    const items: BudgetPerformanceItemDto[] = budgetItems.map((item) => {
      const allocated = Number(item.allocation);
      const spent = spentMap.get(item.category) || 0;
      const remaining = allocated - spent;
      const percentage = allocated > 0 ? (spent / allocated) * 100 : 0;
      const isOverBudget = spent > allocated;

      return {
        category: item.category,
        allocated,
        spent,
        remaining,
        percentage,
        is_over_budget: isOverBudget,
      };
    });

    // Calculate totals
    const totalAllocated = items.reduce((sum, item) => sum + item.allocated, 0);
    const totalSpent = items.reduce((sum, item) => sum + item.spent, 0);
    const totalRemaining = totalAllocated - totalSpent;
    const overallPercentage =
      totalAllocated > 0 ? (totalSpent / totalAllocated) * 100 : 0;

    return {
      month: dto.month,
      year: dto.year,
      items,
      total_allocated: totalAllocated,
      total_spent: totalSpent,
      total_remaining: totalRemaining,
      overall_percentage: overallPercentage,
    };
  }
}
