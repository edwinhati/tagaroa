import { Inject, Injectable } from "@nestjs/common";
import { and, between, desc, eq } from "drizzle-orm";
import type { BunSQLDatabase } from "drizzle-orm/bun-sql";
import { DRIZZLE } from "../../../../../../shared/database/database.constants";
import type { CashFlow } from "../../../../domain/portfolio/entities/cash-flow.entity";
import type { ICashFlowRepository } from "../../../../domain/portfolio/repositories/cash-flow.repository.interface";
import { CashFlowMapper } from "../mappers/cash-flow.mapper";
import { cashFlows } from "../schemas/cash-flow.schema";

@Injectable()
export class DrizzleCashFlowRepository implements ICashFlowRepository {
  @Inject(DRIZZLE)
  private readonly db!: BunSQLDatabase;

  async findById(id: string): Promise<CashFlow | null> {
    const [row] = await this.db
      .select()
      .from(cashFlows)
      .where(eq(cashFlows.id, id))
      .limit(1);
    return row ? CashFlowMapper.toDomain(row) : null;
  }

  async findByPortfolioId(
    portfolioId: string,
    offset = 0,
    limit = 50,
  ): Promise<CashFlow[]> {
    const rows = await this.db
      .select()
      .from(cashFlows)
      .where(eq(cashFlows.portfolioId, portfolioId))
      .orderBy(desc(cashFlows.timestamp))
      .limit(limit)
      .offset(offset);
    return rows.map(CashFlowMapper.toDomain);
  }

  async findByPortfolioIdInRange(
    portfolioId: string,
    start: Date,
    end: Date,
  ): Promise<CashFlow[]> {
    const rows = await this.db
      .select()
      .from(cashFlows)
      .where(
        and(
          eq(cashFlows.portfolioId, portfolioId),
          between(cashFlows.timestamp, start, end),
        ),
      )
      .orderBy(desc(cashFlows.timestamp));
    return rows.map(CashFlowMapper.toDomain);
  }

  async create(cashFlow: CashFlow): Promise<CashFlow> {
    const [row] = await this.db
      .insert(cashFlows)
      .values(CashFlowMapper.toPersistence(cashFlow))
      .returning();
    if (!row) throw new Error("Failed to create cash flow");
    return CashFlowMapper.toDomain(row);
  }

  async delete(id: string): Promise<void> {
    await this.db.delete(cashFlows).where(eq(cashFlows.id, id));
  }
}
