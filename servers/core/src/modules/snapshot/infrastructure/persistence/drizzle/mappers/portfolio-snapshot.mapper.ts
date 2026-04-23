import type { InferSelectModel } from "drizzle-orm";
import { PortfolioSnapshot } from "../../../../domain/entities/portfolio-snapshot.entity";
import type { portfolio } from "../schemas/portfolio.schema";

type PortfolioSnapshotRow = InferSelectModel<typeof portfolio>;

function mapPortfolioSnapshotToDomain(
  row: PortfolioSnapshotRow,
): PortfolioSnapshot {
  return new PortfolioSnapshot(
    row.id,
    row.portfolioId,
    row.userId,
    new Date(row.timestamp),
    Number(row.nav),
    Number(row.cash),
    (row.positionsSnapshot as Record<string, unknown>) ?? null,
    row.createdAt ?? new Date(),
    Number(row.version),
  );
}

function mapPortfolioSnapshotToPersistence(
  entity: PortfolioSnapshot,
): Omit<PortfolioSnapshotRow, "createdAt"> {
  return {
    id: entity.id,
    portfolioId: entity.portfolioId,
    userId: entity.userId,
    timestamp: entity.timestamp,
    nav: String(entity.nav),
    cash: String(entity.cash),
    positionsSnapshot: entity.positionsSnapshot,
    version: String(entity.version),
  };
}

export const PortfolioSnapshotMapper = {
  toDomain: mapPortfolioSnapshotToDomain,
  toPersistence: mapPortfolioSnapshotToPersistence,
};
