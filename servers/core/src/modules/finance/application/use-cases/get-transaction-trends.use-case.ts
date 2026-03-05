import { Inject, Injectable } from "@nestjs/common";
import {
  type ITransactionRepository,
  TRANSACTION_REPOSITORY,
} from "../../domain/repositories/transaction.repository.interface";
import type { GetTransactionTrendsDto } from "../dtos/dashboard/get-transaction-trends.dto";
import type {
  TransactionTrendItemDto,
  TransactionTrendsResponseDto,
} from "../dtos/dashboard/transaction-trends-response.dto";

@Injectable()
export class GetTransactionTrendsUseCase {
  @Inject(TRANSACTION_REPOSITORY)
  private readonly transactionRepository!: ITransactionRepository;

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

    const rows = await this.transactionRepository.aggregateTrends(
      userId,
      startDate,
      endDate,
      granularity,
    );

    const trends: TransactionTrendItemDto[] = rows.map((row) => ({
      period: row.period,
      income: row.income,
      expenses: row.expenses,
      net_flow: row.income - row.expenses,
    }));

    return {
      granularity,
      trends,
    };
  }
}
