import type { InferSelectModel } from "drizzle-orm";
import { PortfolioSnapshot } from "../../../../domain/entities/portfolio-snapshot.entity";
import type { portfolio } from "../schemas/portfolio.schema";

type PortfolioSnapshotRow = InferSelectModel<typeof portfolio>;

function mapPortfolioSnapshotToDomain(
  row: PortfolioSnapshotRow,
): PortfolioSnapshot {
  const archivedAt = row.archivedAt ? new Date(row.archivedAt) : null;
  const s3Key = row.s3Key ?? null;
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
    archivedAt,
    s3Key,
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
    archivedAt: entity.archivedAt ?? null,
    s3Key: entity.s3Key ?? null,
    version: String(entity.version),
  };
}

export const PortfolioSnapshotMapper = {
  toDomain: mapPortfolioSnapshotToDomain,
  toPersistence: mapPortfolioSnapshotToPersistence,
};
