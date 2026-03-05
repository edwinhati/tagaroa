import { Inject, Injectable } from "@nestjs/common";
import { desc, eq } from "drizzle-orm";
import type { BunSQLDatabase } from "drizzle-orm/bun-sql";
import { DRIZZLE } from "../../../../../../shared/database/database.constants";
import type { Trade } from "../../../../domain/portfolio/entities/trade.entity";
import type { ITradeRepository } from "../../../../domain/portfolio/repositories/trade.repository.interface";
import { TradeMapper } from "../mappers/trade.mapper";
import { trades } from "../schemas/trade.schema";

@Injectable()
export class DrizzleTradeRepository implements ITradeRepository {
  @Inject(DRIZZLE)
  private readonly db!: BunSQLDatabase;

  async findById(id: string): Promise<Trade | null> {
    const [row] = await this.db
      .select()
      .from(trades)
      .where(eq(trades.id, id))
      .limit(1);
    return row ? TradeMapper.toDomain(row) : null;
  }

  async findByPortfolioId(
    portfolioId: string,
    offset = 0,
    limit = 50,
  ): Promise<Trade[]> {
    const rows = await this.db
      .select()
      .from(trades)
      .where(eq(trades.portfolioId, portfolioId))
      .orderBy(desc(trades.timestamp))
      .limit(limit)
      .offset(offset);
    return rows.map(TradeMapper.toDomain);
  }

  async findByPositionId(positionId: string): Promise<Trade[]> {
    const rows = await this.db
      .select()
      .from(trades)
      .where(eq(trades.positionId, positionId))
      .orderBy(desc(trades.timestamp));
    return rows.map(TradeMapper.toDomain);
  }

  async create(trade: Trade): Promise<Trade> {
    const [row] = await this.db
      .insert(trades)
      .values(TradeMapper.toPersistence(trade))
      .returning();
    if (!row) throw new Error("Failed to create trade");
    return TradeMapper.toDomain(row);
  }

  async createMany(tradeList: Trade[]): Promise<Trade[]> {
    if (tradeList.length === 0) return [];
    const rows = await this.db
      .insert(trades)
      .values(tradeList.map(TradeMapper.toPersistence))
      .returning();
    return rows.map(TradeMapper.toDomain);
  }
}
