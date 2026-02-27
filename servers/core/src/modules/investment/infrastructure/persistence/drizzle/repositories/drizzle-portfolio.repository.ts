import { Inject, Injectable } from "@nestjs/common";
import { and, count, eq, isNull, sql } from "drizzle-orm";
import type { BunSQLDatabase } from "drizzle-orm/bun-sql";
import { DRIZZLE } from "../../../../../../shared/database/database.constants";
import { ConcurrentModificationException } from "../../../../../../shared/exceptions/domain.exception";
import type { PaginatedResult } from "../../../../../../shared/types/pagination";
import type { Portfolio } from "../../../../domain/portfolio/entities/portfolio.entity";
import type { IPortfolioRepository } from "../../../../domain/portfolio/repositories/portfolio.repository.interface";
import { PortfolioMapper } from "../mappers/portfolio.mapper";
import { portfolios } from "../schemas/portfolio.schema";

@Injectable()
export class DrizzlePortfolioRepository implements IPortfolioRepository {
  constructor(@Inject(DRIZZLE) private readonly db: BunSQLDatabase) {}

  async findById(id: string): Promise<Portfolio | null> {
    const [row] = await this.db
      .select()
      .from(portfolios)
      .where(and(eq(portfolios.id, id), isNull(portfolios.deletedAt)))
      .limit(1);
    return row ? PortfolioMapper.toDomain(row) : null;
  }

  async findByUserId(userId: string): Promise<Portfolio[]> {
    const rows = await this.db
      .select()
      .from(portfolios)
      .where(and(eq(portfolios.userId, userId), isNull(portfolios.deletedAt)));
    return rows.map(PortfolioMapper.toDomain);
  }

  async findByUserIdPaginated(
    userId: string,
    offset: number,
    limit: number,
  ): Promise<PaginatedResult<Portfolio>> {
    const where = and(
      eq(portfolios.userId, userId),
      isNull(portfolios.deletedAt),
    );

    const [rows, countResult] = await Promise.all([
      this.db
        .select()
        .from(portfolios)
        .where(where)
        .limit(limit)
        .offset(offset),
      this.db.select({ total: count() }).from(portfolios).where(where),
    ]);

    return {
      items: rows.map(PortfolioMapper.toDomain),
      total: countResult[0]?.total ?? 0,
    };
  }

  async findAllActive(): Promise<Portfolio[]> {
    const rows = await this.db
      .select()
      .from(portfolios)
      .where(
        and(isNull(portfolios.deletedAt), sql`${portfolios.status} = 'active'`),
      );
    return rows.map(PortfolioMapper.toDomain);
  }

  async create(portfolio: Portfolio): Promise<Portfolio> {
    const [row] = await this.db
      .insert(portfolios)
      .values(PortfolioMapper.toPersistence(portfolio))
      .returning();
    if (!row) throw new Error("Failed to create portfolio");
    return PortfolioMapper.toDomain(row);
  }

  async update(portfolio: Portfolio): Promise<Portfolio> {
    const data = PortfolioMapper.toPersistence(portfolio);
    const [row] = await this.db
      .update(portfolios)
      .set({ ...data, version: (portfolio.version ?? 0) + 1 })
      .where(
        and(
          eq(portfolios.id, portfolio.id),
          eq(portfolios.version, portfolio.version),
        ),
      )
      .returning();

    if (!row) {
      throw new ConcurrentModificationException("Portfolio", portfolio.id);
    }
    return PortfolioMapper.toDomain(row);
  }

  async delete(id: string): Promise<void> {
    await this.db
      .update(portfolios)
      .set({ deletedAt: new Date() })
      .where(eq(portfolios.id, id));
  }
}
