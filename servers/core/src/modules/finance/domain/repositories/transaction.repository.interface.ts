import type {
  AggregationBucket,
  PaginatedResult,
} from "../../../../shared/types/pagination";
import type { Transaction } from "../entities/transaction.entity";
import type { TransactionType } from "../value-objects/transaction-type";

export const TRANSACTION_REPOSITORY = "TRANSACTION_REPOSITORY";

export type TransactionFilterParams = {
  search?: string;
  types?: TransactionType[];
  accountIds?: string[];
  budgetItems?: string[];
  currencies?: string[];
  startDate?: Date;
  endDate?: Date;
  orderBy?: string;
};

export interface ITransactionRepository {
  findById(id: string): Promise<Transaction | null>;
  findByUserId(userId: string): Promise<Transaction[]>;
  findByAccountId(accountId: string): Promise<Transaction[]>;
  findByBudgetItemId(budgetItemId: string): Promise<Transaction[]>;
  create(transaction: Transaction): Promise<Transaction>;
  update(transaction: Transaction): Promise<Transaction>;
  delete(id: string): Promise<void>;

  findAll(
    userId: string,
    offset: number,
    limit: number,
    filters?: TransactionFilterParams,
  ): Promise<PaginatedResult<Transaction>>;

  // Aggregation methods
  aggregateByType(
    userId: string,
    filters?: TransactionFilterParams,
  ): Promise<AggregationBucket[]>;

  aggregateByCurrency(
    userId: string,
    filters?: TransactionFilterParams,
  ): Promise<AggregationBucket[]>;

  aggregateByAccount(
    userId: string,
    filters?: TransactionFilterParams,
  ): Promise<AggregationBucket[]>;

  aggregateByCategory(
    userId: string,
    filters?: TransactionFilterParams,
  ): Promise<AggregationBucket[]>;

  aggregateTrends(
    userId: string,
    startDate: Date,
    endDate: Date,
    granularity: "day" | "week" | "month" | "year",
  ): Promise<{ period: string; income: number; expenses: number }[]>;
}
