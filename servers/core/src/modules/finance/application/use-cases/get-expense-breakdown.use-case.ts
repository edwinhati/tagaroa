import { Inject, Injectable } from "@nestjs/common";
import {
  type ITransactionRepository,
  TRANSACTION_REPOSITORY,
} from "../../domain/repositories/transaction.repository.interface";
import { TransactionType } from "../../domain/value-objects/transaction-type";
import type {
  ExpenseBreakdownItemDto,
  ExpenseBreakdownResponseDto,
} from "../dtos/dashboard/expense-breakdown-response.dto";
import type { GetExpenseBreakdownDto } from "../dtos/dashboard/get-expense-breakdown.dto";

@Injectable()
export class GetExpenseBreakdownUseCase {
  constructor(
    @Inject(TRANSACTION_REPOSITORY)
    private readonly transactionRepository: ITransactionRepository,
  ) {}

  async execute(
    userId: string,
    dto: GetExpenseBreakdownDto,
  ): Promise<ExpenseBreakdownResponseDto> {
    // Default to last 3 months if no dates provided
    const endDate = dto.end_date ? new Date(dto.end_date) : new Date();
    const startDate = dto.start_date
      ? new Date(dto.start_date)
      : new Date(endDate.getFullYear(), endDate.getMonth() - 3, 1);

    // Fetch expense transactions grouped by category
    const categoryAggregations =
      await this.transactionRepository.aggregateByCategory(userId, {
        startDate,
        endDate,
        types: [TransactionType.EXPENSE],
      });

    // Calculate total expenses
    const totalExpenses = categoryAggregations.reduce(
      (sum, agg) => sum + agg.sum,
      0,
    );

    // Build breakdown items (aggregateByCategory already returns category names in the key field)
    const items: ExpenseBreakdownItemDto[] = categoryAggregations
      .map((agg) => {
        const category = agg.key || "Uncategorized";
        const amount = agg.sum;
        const percentage =
          totalExpenses > 0 ? (amount / totalExpenses) * 100 : 0;

        return {
          category,
          amount,
          percentage,
        };
      })
      .sort((a, b) => b.amount - a.amount); // Sort by amount descending

    return {
      total_expenses: totalExpenses,
      items,
    };
  }
}
