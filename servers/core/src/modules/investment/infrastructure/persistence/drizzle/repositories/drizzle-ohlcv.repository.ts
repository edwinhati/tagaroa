import { Inject, Injectable } from "@nestjs/common";
import { and, asc, desc, eq, gte, lte, type SQL, sql } from "drizzle-orm";
import type { BunSQLDatabase } from "drizzle-orm/bun-sql";
import { DRIZZLE } from "../../../../../../shared/database/database.constants";
import type { Ohlcv } from "../../../../domain/market-data/entities/ohlcv.entity";
import type {
  IOhlcvRepository,
  OhlcvQueryParams,
} from "../../../../domain/market-data/repositories/ohlcv.repository.interface";
import type { Timeframe } from "../../../../domain/value-objects/timeframe.value-object";
import { OhlcvMapper } from "../mappers/ohlcv.mapper";
import { ohlcv } from "../schemas/ohlcv.schema";

@Injectable()
export class DrizzleOhlcvRepository implements IOhlcvRepository {
  @Inject(DRIZZLE)
  private readonly db!: BunSQLDatabase;

  async findMany(params: OhlcvQueryParams): Promise<Ohlcv[]> {
    const conditions = [
      eq(ohlcv.instrumentId, params.instrumentId),
      eq(ohlcv.timeframe, params.timeframe),
    ];

    if (params.startDate) {
      conditions.push(gte(ohlcv.timestamp, params.startDate));
    }
    if (params.endDate) {
      conditions.push(lte(ohlcv.timestamp, params.endDate));
    }

    const baseQuery = this.db
      .select()
      .from(ohlcv)
      .where(and(...conditions))
      .orderBy(asc(ohlcv.timestamp));

    const rows = await (params.limit
      ? baseQuery.limit(params.limit)
      : baseQuery);
    return rows.map(OhlcvMapper.toDomain);
  }

  async upsertMany(candles: Ohlcv[]): Promise<void> {
    if (candles.length === 0) return;

    const values = candles.map(OhlcvMapper.toPersistence);

    await this.db
      .insert(ohlcv)
      .values(values)
      .onConflictDoUpdate({
        target: [ohlcv.instrumentId, ohlcv.timestamp, ohlcv.timeframe],
        set: {
          open: sql`excluded.open`,
          high: sql`excluded.high`,
          low: sql`excluded.low`,
          close: sql`excluded.close`,
          volume: sql`excluded.volume`,
        },
      });
  }

  async findLatest(
    instrumentId: string,
    timeframe?: Timeframe,
  ): Promise<Ohlcv | null> {
    const conditions: SQL[] = [eq(ohlcv.instrumentId, instrumentId)];
    if (timeframe) conditions.push(eq(ohlcv.timeframe, timeframe));

    const [row] = await this.db
      .select()
      .from(ohlcv)
      .where(and(...conditions))
      .orderBy(desc(ohlcv.timestamp))
      .limit(1);

    return row ? OhlcvMapper.toDomain(row) : null;
  }

  async findLatestBatch(instrumentIds: string[]): Promise<Map<string, number>> {
    if (instrumentIds.length === 0) return new Map();

    const results = await Promise.all(
      instrumentIds.map((id) => this.findLatest(id)),
    );

    const priceMap = new Map<string, number>();
    for (let i = 0; i < instrumentIds.length; i++) {
      const candle = results[i];
      const id = instrumentIds[i];
      if (candle && id) priceMap.set(id, candle.close);
    }
    return priceMap;
  }
}
