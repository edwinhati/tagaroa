import type { PortfolioSnapshot } from "../entities/portfolio-snapshot.entity";

export const PORTFOLIO_SNAPSHOT_REPOSITORY = Symbol(
  "PORTFOLIO_SNAPSHOT_REPOSITORY",
);

export interface IPortfolioSnapshotRepository {
  findByPortfolioId(portfolioId: string): Promise<PortfolioSnapshot[]>;
  findByPortfolioIdInRange(
    portfolioId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<PortfolioSnapshot[]>;
  findLatest(portfolioId: string): Promise<PortfolioSnapshot | null>;
  create(snapshot: PortfolioSnapshot): Promise<PortfolioSnapshot>;
  findUnarchivedBeforeDate(date: Date): Promise<PortfolioSnapshot[]>;
  markAsArchived(id: string, archiveKey: string): Promise<void>;
}
