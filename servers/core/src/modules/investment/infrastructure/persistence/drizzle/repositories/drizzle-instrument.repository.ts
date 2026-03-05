import { Inject, Injectable } from "@nestjs/common";
import { and, count, eq, ilike, or, type SQL } from "drizzle-orm";
import type { BunSQLDatabase } from "drizzle-orm/bun-sql";
import { DRIZZLE } from "../../../../../../shared/database/database.constants";
import type { PaginatedResult } from "../../../../../../shared/types/pagination";
import type { Instrument } from "../../../../domain/market-data/entities/instrument.entity";
import type {
  IInstrumentRepository,
  InstrumentFilterParams,
} from "../../../../domain/market-data/repositories/instrument.repository.interface";
import { InstrumentMapper } from "../mappers/instrument.mapper";
import { instruments } from "../schemas/instrument.schema";

@Injectable()
export class DrizzleInstrumentRepository implements IInstrumentRepository {
  @Inject(DRIZZLE)
  private readonly db!: BunSQLDatabase;

  async findById(id: string): Promise<Instrument | null> {
    const [row] = await this.db
      .select()
      .from(instruments)
      .where(eq(instruments.id, id))
      .limit(1);
    return row ? InstrumentMapper.toDomain(row) : null;
  }

  async findByTicker(ticker: string): Promise<Instrument | null> {
    const [row] = await this.db
      .select()
      .from(instruments)
      .where(eq(instruments.ticker, ticker.toUpperCase()))
      .limit(1);
    return row ? InstrumentMapper.toDomain(row) : null;
  }

  async findAllPaginated(
    offset: number,
    limit: number,
    filters?: InstrumentFilterParams,
  ): Promise<PaginatedResult<Instrument>> {
    const conditions: SQL[] = [];

    if (filters?.search) {
      const pattern = `%${filters.search}%`;
      const searchCondition = or(
        ilike(instruments.ticker, pattern),
        ilike(instruments.name, pattern),
      );
      if (searchCondition) conditions.push(searchCondition);
    }

    if (filters?.assetClass) {
      conditions.push(eq(instruments.assetClass, filters.assetClass));
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [rows, countResult] = await Promise.all([
      this.db
        .select()
        .from(instruments)
        .where(where)
        .limit(limit)
        .offset(offset),
      this.db.select({ total: count() }).from(instruments).where(where),
    ]);

    return {
      items: rows.map(InstrumentMapper.toDomain),
      total: countResult[0]?.total ?? 0,
    };
  }

  async create(instrument: Instrument): Promise<Instrument> {
    const [row] = await this.db
      .insert(instruments)
      .values(InstrumentMapper.toPersistence(instrument))
      .returning();
    if (!row) throw new Error("Failed to create instrument");
    return InstrumentMapper.toDomain(row);
  }

  async update(instrument: Instrument): Promise<Instrument> {
    const [row] = await this.db
      .update(instruments)
      .set(InstrumentMapper.toPersistence(instrument))
      .where(eq(instruments.id, instrument.id))
      .returning();
    if (!row) throw new Error("Failed to update instrument");
    return InstrumentMapper.toDomain(row);
  }

  async delete(id: string): Promise<void> {
    await this.db.delete(instruments).where(eq(instruments.id, id));
  }
}
