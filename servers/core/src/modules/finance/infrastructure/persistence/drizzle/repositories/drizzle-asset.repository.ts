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
import type { Asset } from "../../../../domain/entities/asset.entity";
import type {
  AssetFilterParams,
  IAssetRepository,
} from "../../../../domain/repositories/asset.repository.interface";
import { AssetMapper } from "../mappers/asset.mapper";
import { assets } from "../schemas/asset.schema";

export class DrizzleAssetRepository
  extends DrizzleBaseRepository
  implements IAssetRepository
{
  private buildWhereConditions(
    userId: string,
    filters?: AssetFilterParams,
  ): SQL {
    const conditions: SQL[] = [
      eq(assets.userId, userId),
      isNull(assets.deletedAt),
    ];

    if (filters?.search) {
      const pattern = `%${filters.search}%`;
      const searchCondition = or(
        ilike(assets.name, pattern),
        ilike(sql`COALESCE(${assets.notes}, '')`, pattern),
        ilike(sql`COALESCE(${assets.ticker}, '')`, pattern),
      );
      if (searchCondition) {
        conditions.push(searchCondition);
      }
    }

    if (filters?.types && filters.types.length > 0) {
      conditions.push(inArray(assets.type, filters.types));
    }

    if (filters?.currencies && filters.currencies.length > 0) {
      conditions.push(inArray(assets.currency, filters.currencies));
    }

    const whereCondition = and(...conditions);
    if (!whereCondition) {
      throw new Error("Failed to build where conditions");
    }
    return whereCondition;
  }

  async findById(id: string): Promise<Asset | null> {
    const [row] = await this.getDb()
      .select()
      .from(assets)
      .where(and(eq(assets.id, id), isNull(assets.deletedAt)))
      .limit(1);

    return row ? AssetMapper.toDomain(row) : null;
  }

  async findByIds(ids: string[]): Promise<Asset[]> {
    if (ids.length === 0) return [];

    const rows = await this.getDb()
      .select()
      .from(assets)
      .where(and(inArray(assets.id, ids), isNull(assets.deletedAt)));

    return rows.map(AssetMapper.toDomain);
  }

  async findByUserId(userId: string): Promise<Asset[]> {
    const rows = await this.getDb()
      .select()
      .from(assets)
      .where(and(eq(assets.userId, userId), isNull(assets.deletedAt)));

    return rows.map(AssetMapper.toDomain);
  }

  async findByUserIdPaginated(
    userId: string,
    offset: number,
    limit: number,
    filters?: AssetFilterParams,
  ): Promise<PaginatedResult<Asset>> {
    const where = this.buildWhereConditions(userId, filters);
    const [rows, countResult] = await Promise.all([
      this.getDb()
        .select()
        .from(assets)
        .where(where)
        .limit(limit)
        .offset(offset),
      this.getDb().select({ total: count() }).from(assets).where(where),
    ]);
    const total = countResult[0]?.total ?? 0;

    return {
      items: rows.map(AssetMapper.toDomain),
      total,
    };
  }

  async aggregateByType(
    userId: string,
    filters?: AssetFilterParams,
  ): Promise<AggregationBucket[]> {
    const { types: _, ...filtersWithoutType } = filters ?? {};
    const where = this.buildWhereConditions(userId, filtersWithoutType);
    const rows = await this.getDb()
      .select({
        key: assets.type,
        count: count(),
        min: min(assets.value),
        max: max(assets.value),
        avg: avg(assets.value),
        sum: sum(assets.value),
      })
      .from(assets)
      .where(where)
      .groupBy(assets.type);

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
    filters?: AssetFilterParams,
  ): Promise<AggregationBucket[]> {
    const { currencies: _, ...filtersWithoutCurrency } = filters ?? {};
    const where = this.buildWhereConditions(userId, filtersWithoutCurrency);
    const rows = await this.getDb()
      .select({
        key: assets.currency,
        count: count(),
        min: min(assets.value),
        max: max(assets.value),
        avg: avg(assets.value),
        sum: sum(assets.value),
      })
      .from(assets)
      .where(where)
      .groupBy(assets.currency);

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

  async getTotalValue(userId: string, currency?: string): Promise<number> {
    const conditions: SQL[] = [
      eq(assets.userId, userId),
      isNull(assets.deletedAt),
    ];

    if (currency) {
      conditions.push(eq(assets.currency, currency));
    }

    const whereCondition = and(...conditions);
    if (!whereCondition) {
      throw new Error("Failed to build where conditions");
    }

    const [result] = await this.getDb()
      .select({ total: sum(assets.value) })
      .from(assets)
      .where(whereCondition);

    return Number(result?.total) || 0;
  }

  async create(asset: Asset): Promise<Asset> {
    const [row] = await this.getDb()
      .insert(assets)
      .values(AssetMapper.toPersistence(asset))
      .returning();

    if (!row) {
      throw new Error("Failed to create asset");
    }
    return AssetMapper.toDomain(row);
  }

  async update(asset: Asset): Promise<Asset> {
    const data = AssetMapper.toPersistence(asset);
    const [row] = await this.getDb()
      .update(assets)
      .set({ ...data, version: (asset.version ?? 0) + 1 })
      .where(and(eq(assets.id, asset.id), eq(assets.version, asset.version)))
      .returning();

    if (!row) {
      throw new ConcurrentModificationException("Asset", asset.id);
    }

    return AssetMapper.toDomain(row);
  }

  async delete(id: string): Promise<void> {
    await this.getDb()
      .update(assets)
      .set({ deletedAt: new Date() })
      .where(eq(assets.id, id));
  }
}
