import {
  and,
  avg,
  count,
  eq,
  ilike,
  inArray,
  isNull,
  max,
  min,
  or,
  type SQL,
  sql,
  sum,
} from "drizzle-orm";
import { DrizzleBaseRepository } from "../../../../../../shared/database/drizzle-base.repository";
import { ConcurrentModificationException } from "../../../../../../shared/exceptions/domain.exception";
import type {
  AggregationBucket,
  PaginatedResult,
} from "../../../../../../shared/types/pagination";
import type { Liability } from "../../../../domain/entities/liability.entity";
import type {
  ILiabilityRepository,
  LiabilityFilterParams,
} from "../../../../domain/repositories/liability.repository.interface";
import { LiabilityMapper } from "../mappers/liability.mapper";
import { liabilities } from "../schemas/liability.schema";

export class DrizzleLiabilityRepository
  extends DrizzleBaseRepository
  implements ILiabilityRepository
{
  private buildWhereConditions(
    userId: string,
    filters?: LiabilityFilterParams,
  ): SQL {
    const conditions: SQL[] = [
      eq(liabilities.userId, userId),
      isNull(liabilities.deletedAt),
    ];

    if (!filters?.includePaid) {
      conditions.push(isNull(liabilities.paidAt));
    }

    if (filters?.search) {
      const pattern = `%${filters.search}%`;
      const searchCondition = or(
        ilike(liabilities.name, pattern),
        ilike(sql`COALESCE(${liabilities.notes}, '')`, pattern),
      );
      if (searchCondition) {
        conditions.push(searchCondition);
      }
    }

    if (filters?.types && filters.types.length > 0) {
      conditions.push(inArray(liabilities.type, filters.types));
    }

    if (filters?.currencies && filters.currencies.length > 0) {
      conditions.push(inArray(liabilities.currency, filters.currencies));
    }

    const whereCondition = and(...conditions);
    if (!whereCondition) {
      throw new Error("Failed to build where conditions");
    }
    return whereCondition;
  }

  async findById(id: string): Promise<Liability | null> {
    const [row] = await this.getDb()
      .select()
      .from(liabilities)
      .where(and(eq(liabilities.id, id), isNull(liabilities.deletedAt)))
      .limit(1);

    return row ? LiabilityMapper.toDomain(row) : null;
  }

  async findByIds(ids: string[]): Promise<Liability[]> {
    if (ids.length === 0) return [];

    const rows = await this.getDb()
      .select()
      .from(liabilities)
      .where(and(inArray(liabilities.id, ids), isNull(liabilities.deletedAt)));

    return rows.map(LiabilityMapper.toDomain);
  }

  async findByUserId(userId: string): Promise<Liability[]> {
    const rows = await this.getDb()
      .select()
      .from(liabilities)
      .where(
        and(
          eq(liabilities.userId, userId),
          isNull(liabilities.deletedAt),
          isNull(liabilities.paidAt),
        ),
      );

    return rows.map(LiabilityMapper.toDomain);
  }

  async findByUserIdPaginated(
    userId: string,
    offset: number,
    limit: number,
    filters?: LiabilityFilterParams,
  ): Promise<PaginatedResult<Liability>> {
    const where = this.buildWhereConditions(userId, filters);
    const [rows, countResult] = await Promise.all([
      this.getDb()
        .select()
        .from(liabilities)
        .where(where)
        .limit(limit)
        .offset(offset),
      this.getDb().select({ total: count() }).from(liabilities).where(where),
    ]);
    const total = countResult[0]?.total ?? 0;

    return {
      items: rows.map(LiabilityMapper.toDomain),
      total,
    };
  }

  async aggregateByType(
    userId: string,
    filters?: LiabilityFilterParams,
  ): Promise<AggregationBucket[]> {
    const { types: _, ...filtersWithoutType } = filters ?? {};
    const where = this.buildWhereConditions(userId, filtersWithoutType);
    const rows = await this.getDb()
      .select({
        key: liabilities.type,
        count: count(),
        min: min(liabilities.amount),
        max: max(liabilities.amount),
        avg: avg(liabilities.amount),
        sum: sum(liabilities.amount),
      })
      .from(liabilities)
      .where(where)
      .groupBy(liabilities.type);

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
    filters?: LiabilityFilterParams,
  ): Promise<AggregationBucket[]> {
    const { currencies: _, ...filtersWithoutCurrency } = filters ?? {};
    const where = this.buildWhereConditions(userId, filtersWithoutCurrency);
    const rows = await this.getDb()
      .select({
        key: liabilities.currency,
        count: count(),
        min: min(liabilities.amount),
        max: max(liabilities.amount),
        avg: avg(liabilities.amount),
        sum: sum(liabilities.amount),
      })
      .from(liabilities)
      .where(where)
      .groupBy(liabilities.currency);

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

  async getTotalAmount(userId: string, currency?: string): Promise<number> {
    const conditions: SQL[] = [
      eq(liabilities.userId, userId),
      isNull(liabilities.deletedAt),
      isNull(liabilities.paidAt),
    ];

    if (currency) {
      conditions.push(eq(liabilities.currency, currency));
    }

    const whereCondition = and(...conditions);
    if (!whereCondition) {
      throw new Error("Failed to build where conditions");
    }

    const [result] = await this.getDb()
      .select({ total: sum(liabilities.amount) })
      .from(liabilities)
      .where(whereCondition);

    return Number(result?.total) || 0;
  }

  async create(liability: Liability): Promise<Liability> {
    const [row] = await this.getDb()
      .insert(liabilities)
      .values(LiabilityMapper.toPersistence(liability))
      .returning();

    if (!row) {
      throw new Error("Failed to create liability");
    }
    return LiabilityMapper.toDomain(row);
  }

  async update(liability: Liability): Promise<Liability> {
    const data = LiabilityMapper.toPersistence(liability);
    const [row] = await this.getDb()
      .update(liabilities)
      .set({ ...data, version: (liability.version ?? 0) + 1 })
      .where(
        and(
          eq(liabilities.id, liability.id),
          eq(liabilities.version, liability.version),
        ),
      )
      .returning();

    if (!row) {
      throw new ConcurrentModificationException("Liability", liability.id);
    }

    return LiabilityMapper.toDomain(row);
  }

  async delete(id: string): Promise<void> {
    await this.getDb()
      .update(liabilities)
      .set({ deletedAt: new Date() })
      .where(eq(liabilities.id, id));
  }
}
