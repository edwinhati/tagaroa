import type { InferSelectModel } from "drizzle-orm";
import {
  type AssetsBreakdown,
  type FxRatesUsed,
  type LiabilitiesBreakdown,
  NetWorthSnapshot,
} from "../../../../domain/entities/net-worth-snapshot.entity";
import type { netWorth } from "../schemas/net-worth.schema";

type NetWorthSnapshotRow = InferSelectModel<typeof netWorth>;

function mapNetWorthSnapshotToDomain(
  row: NetWorthSnapshotRow,
): NetWorthSnapshot {
  const archivedAt = row.archivedAt ? new Date(row.archivedAt) : null;
  const archiveKey = row.s3Key ?? null;
  return new NetWorthSnapshot(
    row.id,
    row.userId,
    new Date(row.snapshotDate),
    Number(row.totalAssets),
    Number(row.totalLiabilities),
    Number(row.netWorth),
    row.baseCurrency,
    row.assetsBreakdown as AssetsBreakdown,
    row.liabilitiesBreakdown as LiabilitiesBreakdown,
    row.fxRatesUsed as FxRatesUsed,
    new Date(row.fxRateDate),
    row.fxRateSource ?? null,
    row.createdAt ?? new Date(),
    row.version,
    archivedAt,
    archiveKey,
  );
}

function mapNetWorthSnapshotToPersistence(
  entity: NetWorthSnapshot,
): Omit<NetWorthSnapshotRow, "createdAt"> {
  return {
    id: entity.id,
    userId: entity.userId,
    snapshotDate: entity.snapshotDate.toISOString().slice(0, 10),
    totalAssets: String(entity.totalAssets),
    totalLiabilities: String(entity.totalLiabilities),
    netWorth: String(entity.netWorth),
    baseCurrency: entity.baseCurrency,
    assetsBreakdown: entity.assetsBreakdown,
    liabilitiesBreakdown: entity.liabilitiesBreakdown,
    fxRatesUsed: entity.fxRatesUsed,
    fxRateDate: entity.fxRateDate.toISOString().slice(0, 10),
    fxRateSource: entity.fxRateSource,
    version: entity.version,
    archivedAt: entity.archivedAt ?? null,
    s3Key: entity.archiveKey ?? null,
  };
}

export const NetWorthSnapshotMapper = {
  toDomain: mapNetWorthSnapshotToDomain,
  toPersistence: mapNetWorthSnapshotToPersistence,
};
