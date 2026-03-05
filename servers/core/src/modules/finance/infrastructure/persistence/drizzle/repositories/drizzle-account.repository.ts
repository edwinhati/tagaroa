import { Inject, Injectable } from "@nestjs/common";
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
import type { BunSQLDatabase } from "drizzle-orm/bun-sql";
import { DRIZZLE } from "../../../../../../shared/database/database.constants";
import { ConcurrentModificationException } from "../../../../../../shared/exceptions/domain.exception";
import type {
  AggregationBucket,
  PaginatedResult,
} from "../../../../../../shared/types/pagination";
import type { Account } from "../../../../domain/entities/account.entity";
import type {
  AccountFilterParams,
  IAccountRepository,
} from "../../../../domain/repositories/account.repository.interface";
import { AccountMapper } from "../mappers/account.mapper";
import { accounts } from "../schemas/account.schema";

@Injectable()
export class DrizzleAccountRepository implements IAccountRepository {
  @Inject(DRIZZLE)
  private readonly db!: BunSQLDatabase;

  private buildWhereConditions(
    userId: string,
    filters?: AccountFilterParams,
  ): SQL {
    const conditions: SQL[] = [
      eq(accounts.userId, userId),
      isNull(accounts.deletedAt),
    ];

    if (filters?.search) {
      const pattern = `%${filters.search}%`;
      const searchCondition = or(
        ilike(accounts.name, pattern),
        ilike(sql`COALESCE(${accounts.notes}, '')`, pattern),
      );
      if (searchCondition) {
        conditions.push(searchCondition);
      }
    }

    if (filters?.types && filters.types.length > 0) {
      conditions.push(inArray(accounts.type, filters.types));
    }

    const whereCondition = and(...conditions);
    if (!whereCondition) {
      throw new Error("Failed to build where conditions");
    }
    return whereCondition;
  }

  async findById(id: string): Promise<Account | null> {
    const [row] = await this.db
      .select()
      .from(accounts)
      .where(and(eq(accounts.id, id), isNull(accounts.deletedAt)))
      .limit(1);

    return row ? AccountMapper.toDomain(row) : null;
  }

  async findByIds(ids: string[]): Promise<Account[]> {
    if (ids.length === 0) return [];

    const rows = await this.db
      .select()
      .from(accounts)
      .where(and(inArray(accounts.id, ids), isNull(accounts.deletedAt)));

    return rows.map(AccountMapper.toDomain);
  }

  async findByUserId(userId: string): Promise<Account[]> {
    const rows = await this.db
      .select()
      .from(accounts)
      .where(and(eq(accounts.userId, userId), isNull(accounts.deletedAt)));

    return rows.map(AccountMapper.toDomain);
  }

  async findByUserIdPaginated(
    userId: string,
    offset: number,
    limit: number,
    filters?: AccountFilterParams,
  ): Promise<PaginatedResult<Account>> {
    const where = this.buildWhereConditions(userId, filters);
    const [rows, countResult] = await Promise.all([
      this.db.select().from(accounts).where(where).limit(limit).offset(offset),
      this.db.select({ total: count() }).from(accounts).where(where),
    ]);
    const total = countResult[0]?.total ?? 0;

    return {
      items: rows.map(AccountMapper.toDomain),
      total,
    };
  }

  async aggregateByType(
    userId: string,
    filters?: AccountFilterParams,
  ): Promise<AggregationBucket[]> {
    const { types: _, ...filtersWithoutType } = filters ?? {};
    const where = this.buildWhereConditions(userId, filtersWithoutType);
    const rows = await this.db
      .select({
        key: accounts.type,
        count: count(),
        min: min(accounts.balance),
        max: max(accounts.balance),
        avg: avg(accounts.balance),
        sum: sum(accounts.balance),
      })
      .from(accounts)
      .where(where)
      .groupBy(accounts.type);

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

  async create(account: Account): Promise<Account> {
    const [row] = await this.db
      .insert(accounts)
      .values(AccountMapper.toPersistence(account))
      .returning();

    if (!row) {
      throw new Error("Failed to create account");
    }
    return AccountMapper.toDomain(row);
  }

  async update(account: Account): Promise<Account> {
    const data = AccountMapper.toPersistence(account);
    const [row] = await this.db
      .update(accounts)
      .set({ ...data, version: (account.version ?? 0) + 1 })
      .where(
        and(eq(accounts.id, account.id), eq(accounts.version, account.version)),
      )
      .returning();

    if (!row) {
      throw new ConcurrentModificationException("Account", account.id);
    }

    return AccountMapper.toDomain(row);
  }

  async delete(id: string): Promise<void> {
    await this.db
      .update(accounts)
      .set({ deletedAt: new Date() })
      .where(eq(accounts.id, id));
  }
}
