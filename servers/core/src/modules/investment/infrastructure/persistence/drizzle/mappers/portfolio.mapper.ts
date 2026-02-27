import type { InferSelectModel } from "drizzle-orm";
import { Portfolio } from "../../../../domain/portfolio/entities/portfolio.entity";
import type { PortfolioMode } from "../../../../domain/value-objects/portfolio-mode.value-object";
import type { PortfolioStatus } from "../../../../domain/value-objects/portfolio-status.value-object";
import type { portfolios } from "../schemas/portfolio.schema";

type PortfolioRow = InferSelectModel<typeof portfolios>;

export function mapPortfolioToDomain(row: PortfolioRow): Portfolio {
  return new Portfolio(
    row.id,
    row.userId,
    row.name,
    row.mode as PortfolioMode,
    Number(row.initialCapital),
    row.currency,
    row.status as PortfolioStatus,
    row.deletedAt ?? null,
    row.createdAt ?? new Date(),
    row.updatedAt ?? new Date(),
    row.version ?? 1,
  );
}

export function mapPortfolioToPersistence(
  entity: Portfolio,
): Omit<PortfolioRow, "createdAt" | "updatedAt"> {
  return {
    id: entity.id,
    userId: entity.userId,
    name: entity.name,
    mode: entity.mode,
    initialCapital: String(entity.initialCapital),
    currency: entity.currency,
    status: entity.status,
    deletedAt: entity.deletedAt,
    version: entity.version,
  };
}

export const PortfolioMapper = {
  toDomain: mapPortfolioToDomain,
  toPersistence: mapPortfolioToPersistence,
};
