import { Inject, Injectable } from "@nestjs/common";
import {
  type ITransactionRepository,
  TRANSACTION_REPOSITORY,
} from "../../domain/repositories/transaction.repository.interface";
import { TransactionType } from "../../domain/value-objects/transaction-type";
import { GetTransactionTrendsDto } from "../dtos/dashboard/get-transaction-trends.dto";
import {
  TransactionTrendItemDto,
  TransactionTrendsResponseDto,
} from "../dtos/dashboard/transaction-trends-response.dto";
import { formatPeriod } from "../utils/period-helpers";

@Injectable()
export class GetTransactionTrendsUseCase {
  constructor(
    @Inject(TRANSACTION_REPOSITORY)
    private readonly transactionRepository: ITransactionRepository,
  ) {}

  async execute(
    userId: string,
    dto: GetTransactionTrendsDto,
  ): Promise<TransactionTrendsResponseDto> {
    // Default to last 3 months if no dates provided
    const endDate = dto.end_date ? new Date(dto.end_date) : new Date();
    const startDate = dto.start_date
      ? new Date(dto.start_date)
      : new Date(endDate.getFullYear(), endDate.getMonth() - 3, 1);

    const granularity = (dto.granularity || "month") as
      | "day"
      | "week"
      | "month"
      | "year";

    // Fetch all transactions in the date range
    const transactions = await this.transactionRepository.findByUserId(userId);

    // Filter transactions by date range
    const filteredTransactions = transactions.filter((t) => {
      const transactionDate = new Date(t.date);
      return transactionDate >= startDate && transactionDate <= endDate;
    });

    // Group transactions by period
    const periodMap = new Map<string, { income: number; expenses: number }>();

    for (const transaction of filteredTransactions) {
      const transactionDate = new Date(transaction.date);
      const period = formatPeriod(transactionDate, granularity);

      let data = periodMap.get(period);
      if (!data) {
        data = { income: 0, expenses: 0 };
        periodMap.set(period, data);
      }

      if (transaction.type === TransactionType.INCOME) {
        data.income += transaction.amount;
      } else if (transaction.type === TransactionType.EXPENSE) {
        data.expenses += transaction.amount;
      }
    }

    // Convert to array and sort chronologically
    const trends: TransactionTrendItemDto[] = Array.from(periodMap.entries())
      .map(([period, data]) => ({
        period,
        income: data.income,
        expenses: data.expenses,
        net_flow: data.income - data.expenses,
      }))
      .sort((a, b) => a.period.localeCompare(b.period));

    return {
      granularity,
      trends,
    };
  }
}
