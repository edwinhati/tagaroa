import { and, asc, between, desc, eq, isNull, lt } from "drizzle-orm";
import { DrizzleBaseRepository } from "../../../../../../shared/database/drizzle-base.repository";
import type { PortfolioSnapshot } from "../../../../domain/entities/portfolio-snapshot.entity";
import type { IPortfolioSnapshotRepository } from "../../../../domain/repositories/portfolio-snapshot.repository.interface";
import { PortfolioSnapshotMapper } from "../mappers/portfolio-snapshot.mapper";
import { portfolio } from "../schemas/portfolio.schema";

export class DrizzlePortfolioSnapshotRepository
  extends DrizzleBaseRepository
  implements IPortfolioSnapshotRepository
{
  async findByPortfolioId(portfolioId: string): Promise<PortfolioSnapshot[]> {
    const rows = await this.getDb()
      .select()
      .from(portfolio)
      .where(eq(portfolio.portfolioId, portfolioId))
      .orderBy(asc(portfolio.timestamp));

    return rows.map(PortfolioSnapshotMapper.toDomain);
  }

  async findByPortfolioIdInRange(
    portfolioId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<PortfolioSnapshot[]> {
    const rows = await this.getDb()
      .select()
      .from(portfolio)
      .where(
        and(
          eq(portfolio.portfolioId, portfolioId),
          between(portfolio.timestamp, startDate, endDate),
        ),
      )
      .orderBy(asc(portfolio.timestamp));

    return rows.map(PortfolioSnapshotMapper.toDomain);
  }

  async findLatest(portfolioId: string): Promise<PortfolioSnapshot | null> {
    const [row] = await this.getDb()
      .select()
      .from(portfolio)
      .where(eq(portfolio.portfolioId, portfolioId))
      .orderBy(desc(portfolio.timestamp))
      .limit(1);

    return row ? PortfolioSnapshotMapper.toDomain(row) : null;
  }

  async create(snapshot: PortfolioSnapshot): Promise<PortfolioSnapshot> {
    const [row] = await this.getDb()
      .insert(portfolio)
      .values(PortfolioSnapshotMapper.toPersistence(snapshot))
      .returning();

    if (!row) {
      throw new Error("Failed to create portfolio snapshot");
    }
    return PortfolioSnapshotMapper.toDomain(row);
  }

  async findUnarchivedBeforeDate(date: Date): Promise<PortfolioSnapshot[]> {
    const rows = await this.getDb()
      .select()
      .from(portfolio)
      .where(and(lt(portfolio.timestamp, date), isNull(portfolio.archivedAt)))
      .orderBy(asc(portfolio.timestamp));
    return rows.map(PortfolioSnapshotMapper.toDomain);
  }

  async markAsArchived(id: string, s3Key: string): Promise<void> {
    await this.getDb()
      .update(portfolio)
      .set({ archivedAt: new Date(), s3Key })
      .where(eq(portfolio.id, id));
  }
}
