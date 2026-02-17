import { Inject, Injectable } from "@nestjs/common";
import {
  and,
  asc,
  avg,
  count,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  isNull,
  lte,
  max,
  min,
  type SQL,
  sql,
  sum,
} from "drizzle-orm";
import type { BunSQLDatabase } from "drizzle-orm/bun-sql";
import { DRIZZLE } from "../../../../../../shared/database/database.constants";
import {
  AggregationBucket,
  PaginatedResult,
} from "../../../../../../shared/types/pagination";
import { Transaction } from "../../../../domain/entities/transaction.entity";
import type {
  ITransactionRepository,
  TransactionFilterParams,
} from "../../../../domain/repositories/transaction.repository.interface";
import { TransactionMapper } from "../mappers/transaction.mapper";
import { accounts } from "../schemas/account.schema";
import { budgetItems } from "../schemas/budget-item.schema";
import { transactions } from "../schemas/transaction.schema";

@Injectable()
export class DrizzleTransactionRepository implements ITransactionRepository {
  constructor(@Inject(DRIZZLE) private readonly db: BunSQLDatabase) {}

  private buildWhereConditions(
    userId: string,
    filters?: TransactionFilterParams,
  ): SQL {
    const conditions: SQL[] = [
      eq(transactions.userId, userId),
      isNull(transactions.deletedAt),
    ];

    if (filters?.search) {
      conditions.push(ilike(transactions.notes, `%${filters.search}%`));
    }

    if (filters?.types && filters.types.length > 0) {
      conditions.push(inArray(transactions.type, filters.types));
    }

    if (filters?.accountIds && filters.accountIds.length > 0) {
      conditions.push(inArray(transactions.accountId, filters.accountIds));
    }

    if (filters?.budgetItems && filters.budgetItems.length > 0) {
      conditions.push(inArray(transactions.budgetItemId, filters.budgetItems));
    }

    if (filters?.currencies && filters.currencies.length > 0) {
      conditions.push(inArray(transactions.currency, filters.currencies));
    }

    if (filters?.startDate) {
      const dateStr = filters.startDate.toISOString().split("T")[0];
      if (dateStr) {
        conditions.push(gte(transactions.date, dateStr));
      }
    }

    if (filters?.endDate) {
      const dateStr = filters.endDate.toISOString().split("T")[0];
      if (dateStr) {
        conditions.push(lte(transactions.date, dateStr));
      }
    }

    const whereCondition = and(...conditions);
    if (!whereCondition) {
      throw new Error("Failed to build where conditions");
    }
    return whereCondition;
  }

  async findById(id: string): Promise<Transaction | null> {
    const [row] = await this.db
      .select()
      .from(transactions)
      .where(eq(transactions.id, id))
      .limit(1);

    return row ? TransactionMapper.toDomain(row) : null;
  }

  async findByUserId(userId: string): Promise<Transaction[]> {
    const rows = await this.db
      .select()
      .from(transactions)
      .where(
        and(eq(transactions.userId, userId), isNull(transactions.deletedAt)),
      );

    return rows.map(TransactionMapper.toDomain);
  }

  async findByAccountId(accountId: string): Promise<Transaction[]> {
    const rows = await this.db
      .select()
      .from(transactions)
      .where(eq(transactions.accountId, accountId));

    return rows.map(TransactionMapper.toDomain);
  }

  async findByBudgetItemId(budgetItemId: string): Promise<Transaction[]> {
    const rows = await this.db
      .select()
      .from(transactions)
      .where(
        and(
          eq(transactions.budgetItemId, budgetItemId),
          isNull(transactions.deletedAt),
        ),
      );

    return rows.map(TransactionMapper.toDomain);
  }

  async create(transaction: Transaction): Promise<Transaction> {
    const [row] = await this.db
      .insert(transactions)
      .values(TransactionMapper.toPersistence(transaction))
      .returning();

    if (!row) {
      throw new Error("Failed to create transaction");
    }

    return TransactionMapper.toDomain(row);
  }

  async update(transaction: Transaction): Promise<Transaction> {
    const [row] = await this.db
      .update(transactions)
      .set(TransactionMapper.toPersistence(transaction))
      .where(eq(transactions.id, transaction.id))
      .returning();

    if (!row) {
      throw new Error("Transaction not found or update failed");
    }

    return TransactionMapper.toDomain(row);
  }

  async delete(id: string): Promise<void> {
    await this.db
      .update(transactions)
      .set({ deletedAt: new Date() })
      .where(eq(transactions.id, id));
  }

  async findAll(
    userId: string,
    offset: number,
    limit: number,
    filters?: TransactionFilterParams,
  ): Promise<PaginatedResult<Transaction>> {
    const where = this.buildWhereConditions(userId, filters);

    const query = this.db
      .select()
      .from(transactions)
      .where(where)
      .limit(limit)
      .offset(offset);

    if (filters?.orderBy) {
      const parts = filters.orderBy.split(":");
      const field = parts[0];
      const direction = parts[1];

      const allowedSortFields: Record<string, typeof transactions.date> = {
        date: transactions.date,
        amount: transactions.amount,
        createdAt: transactions.createdAt,
      };

      if (field && allowedSortFields[field]) {
        query.orderBy(
          direction === "asc"
            ? asc(allowedSortFields[field])
            : desc(allowedSortFields[field]),
        );
      } else {
        query.orderBy(desc(transactions.date));
      }
    } else {
      query.orderBy(desc(transactions.date));
    }

    const [totalRow] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(transactions)
      .where(where);

    const rows = await query;

    return {
      items: rows.map(TransactionMapper.toDomain),
      total: Number(totalRow?.count ?? 0),
      aggregations: {},
    };
  }

  async aggregateByType(
    userId: string,
    filters?: TransactionFilterParams,
  ): Promise<AggregationBucket[]> {
    // Remove type filter when aggregating by type
    const { types: _, ...filtersWithoutType } = filters ?? {};
    const where = this.buildWhereConditions(userId, filtersWithoutType);

    const rows = await this.db
      .select({
        key: transactions.type,
        count: count(),
        min: min(transactions.amount),
        max: max(transactions.amount),
        avg: avg(transactions.amount),
        sum: sum(transactions.amount),
      })
      .from(transactions)
      .where(where)
      .groupBy(transactions.type);

    return rows.map((row) => ({
      id: row.key,
      key: row.key,
      count: row.count,
      min: Number(row.min) || 0,
      max: Number(row.max) || 0,
      avg: Number(row.avg) || 0,
      sum: Number(row.sum) || 0,
    }));
  }

  async aggregateByCurrency(
    userId: string,
    filters?: TransactionFilterParams,
  ): Promise<AggregationBucket[]> {
    const where = this.buildWhereConditions(userId, filters);

    const rows = await this.db
      .select({
        key: transactions.currency,
        count: count(),
        min: min(transactions.amount),
        max: max(transactions.amount),
        avg: avg(transactions.amount),
        sum: sum(transactions.amount),
      })
      .from(transactions)
      .where(where)
      .groupBy(transactions.currency);

    return rows.map((row) => ({
      id: row.key,
      key: row.key,
      count: row.count,
      min: Number(row.min) || 0,
      max: Number(row.max) || 0,
      avg: Number(row.avg) || 0,
      sum: Number(row.sum) || 0,
    }));
  }

  async aggregateByAccount(
    userId: string,
    filters?: TransactionFilterParams,
  ): Promise<AggregationBucket[]> {
    // Remove account filter when aggregating by account
    const { accountIds: _, ...filtersWithoutAccount } = filters ?? {};
    const where = this.buildWhereConditions(userId, filtersWithoutAccount);

    const rows = await this.db
      .select({
        id: accounts.id,
        key: accounts.name,
        count: count(),
        min: min(transactions.amount),
        max: max(transactions.amount),
        avg: avg(transactions.amount),
        sum: sum(transactions.amount),
      })
      .from(transactions)
      .innerJoin(accounts, eq(transactions.accountId, accounts.id))
      .where(and(where, isNull(accounts.deletedAt)))
      .groupBy(accounts.id, accounts.name);

    return rows.map((row) => ({
      id: row.id,
      key: row.key,
      count: row.count,
      min: Number(row.min) || 0,
      max: Number(row.max) || 0,
      avg: Number(row.avg) || 0,
      sum: Number(row.sum) || 0,
    }));
  }

  async aggregateByCategory(
    userId: string,
    filters?: TransactionFilterParams,
  ): Promise<AggregationBucket[]> {
    // Remove budget item filter when aggregating by category
    const { budgetItems: _, ...filtersWithoutBudgetItems } = filters ?? {};
    const where = this.buildWhereConditions(userId, filtersWithoutBudgetItems);

    const rows = await this.db
      .select({
        key: budgetItems.category,
        count: count(),
        min: min(transactions.amount),
        max: max(transactions.amount),
        avg: avg(transactions.amount),
        sum: sum(transactions.amount),
      })
      .from(transactions)
      .innerJoin(budgetItems, eq(transactions.budgetItemId, budgetItems.id))
      .where(and(where, isNull(budgetItems.deletedAt)))
      .groupBy(budgetItems.category);

    return rows.map((row) => ({
      id: row.key,
      key: row.key,
      count: row.count,
      min: Number(row.min) || 0,
      max: Number(row.max) || 0,
      avg: Number(row.avg) || 0,
      sum: Number(row.sum) || 0,
    }));
  }
}
