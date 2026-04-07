import { Inject, Injectable } from "@nestjs/common";
import { and, asc, desc, eq, gte, lte } from "drizzle-orm";
import type { BunSQLDatabase } from "drizzle-orm/bun-sql";
import { DRIZZLE } from "../../../../../../shared/database/database.constants";
import type { PortfolioSnapshot } from "../../../../domain/performance/entities/portfolio-snapshot.entity";
import type { IPortfolioSnapshotRepository } from "../../../../domain/performance/repositories/snapshot.repository.interface";
import { portfolioSnapshots } from "../schemas/portfolio-snapshot.schema";

@Injectable()
export class DrizzleSnapshotRepository implements IPortfolioSnapshotRepository {
  @Inject(DRIZZLE)
  private readonly db!: BunSQLDatabase;

  private rowToDomain(
    row: typeof portfolioSnapshots.$inferSelect,
  ): PortfolioSnapshot {
    return {
      id: row.id,
      portfolioId: row.portfolioId,
      timestamp: row.timestamp,
      nav: Number(row.nav),
      cash: Number(row.cash),
      positionsSnapshot: row.positionsSnapshot as Record<
        string,
        unknown
      > | null,
      createdAt: row.createdAt ?? new Date(),
      version: Number(row.version),
    } as PortfolioSnapshot;
  }

  async findByPortfolioId(portfolioId: string): Promise<PortfolioSnapshot[]> {
    const rows = await this.db
      .select()
      .from(portfolioSnapshots)
      .where(eq(portfolioSnapshots.portfolioId, portfolioId))
      .orderBy(asc(portfolioSnapshots.timestamp));
    return rows.map((r) => this.rowToDomain(r));
  }

  async findByPortfolioIdInRange(
    portfolioId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<PortfolioSnapshot[]> {
    const rows = await this.db
      .select()
      .from(portfolioSnapshots)
      .where(
        and(
          eq(portfolioSnapshots.portfolioId, portfolioId),
          gte(portfolioSnapshots.timestamp, startDate),
          lte(portfolioSnapshots.timestamp, endDate),
        ),
      )
      .orderBy(asc(portfolioSnapshots.timestamp));
    return rows.map((r) => this.rowToDomain(r));
  }

  async findLatest(portfolioId: string): Promise<PortfolioSnapshot | null> {
    const [row] = await this.db
      .select()
      .from(portfolioSnapshots)
      .where(eq(portfolioSnapshots.portfolioId, portfolioId))
      .orderBy(desc(portfolioSnapshots.timestamp))
      .limit(1);
    return row ? this.rowToDomain(row) : null;
  }

  async create(snapshot: PortfolioSnapshot): Promise<PortfolioSnapshot> {
    const [row] = await this.db
      .insert(portfolioSnapshots)
      .values({
        id: snapshot.id,
        portfolioId: snapshot.portfolioId,
        timestamp: snapshot.timestamp,
        nav: String(snapshot.nav),
        cash: String(snapshot.cash),
        positionsSnapshot: snapshot.positionsSnapshot,
        version: String(snapshot.version),
      })
      .returning();
    if (!row) throw new Error("Failed to create snapshot");
    return this.rowToDomain(row);
  }
}
