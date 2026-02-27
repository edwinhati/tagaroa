import { Inject, Injectable } from "@nestjs/common";
import { and, eq, isNull } from "drizzle-orm";
import type { BunSQLDatabase } from "drizzle-orm/bun-sql";
import { DRIZZLE } from "../../../../../../shared/database/database.constants";
import type { Position } from "../../../../domain/portfolio/entities/position.entity";
import type { IPositionRepository } from "../../../../domain/portfolio/repositories/position.repository.interface";
import { PositionMapper } from "../mappers/position.mapper";
import { positions } from "../schemas/position.schema";

@Injectable()
export class DrizzlePositionRepository implements IPositionRepository {
  constructor(@Inject(DRIZZLE) private readonly db: BunSQLDatabase) {}

  async findById(id: string): Promise<Position | null> {
    const [row] = await this.db
      .select()
      .from(positions)
      .where(eq(positions.id, id))
      .limit(1);
    return row ? PositionMapper.toDomain(row) : null;
  }

  async findByPortfolioId(portfolioId: string): Promise<Position[]> {
    const rows = await this.db
      .select()
      .from(positions)
      .where(eq(positions.portfolioId, portfolioId));
    return rows.map(PositionMapper.toDomain);
  }

  async findOpenByPortfolioId(portfolioId: string): Promise<Position[]> {
    const rows = await this.db
      .select()
      .from(positions)
      .where(
        and(eq(positions.portfolioId, portfolioId), isNull(positions.closedAt)),
      );
    return rows.map(PositionMapper.toDomain);
  }

  async findByPortfolioAndInstrument(
    portfolioId: string,
    instrumentId: string,
  ): Promise<Position | null> {
    const [row] = await this.db
      .select()
      .from(positions)
      .where(
        and(
          eq(positions.portfolioId, portfolioId),
          eq(positions.instrumentId, instrumentId),
          isNull(positions.closedAt),
        ),
      )
      .limit(1);
    return row ? PositionMapper.toDomain(row) : null;
  }

  async create(position: Position): Promise<Position> {
    const [row] = await this.db
      .insert(positions)
      .values(PositionMapper.toPersistence(position))
      .returning();
    if (!row) throw new Error("Failed to create position");
    return PositionMapper.toDomain(row);
  }

  async update(position: Position): Promise<Position> {
    const [row] = await this.db
      .update(positions)
      .set(PositionMapper.toPersistence(position))
      .where(eq(positions.id, position.id))
      .returning();
    if (!row) throw new Error("Failed to update position");
    return PositionMapper.toDomain(row);
  }
}
