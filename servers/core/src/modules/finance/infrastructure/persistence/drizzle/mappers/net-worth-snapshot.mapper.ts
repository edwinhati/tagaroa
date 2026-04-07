import type { InferSelectModel } from "drizzle-orm";
import { NetWorthSnapshot } from "../../../../domain/entities/net-worth-snapshot.entity";
import type { Currency } from "../../../../domain/value-objects/currency";
import type { netWorthSnapshots } from "../schemas/net-worth-snapshot.schema";

type NetWorthSnapshotRow = InferSelectModel<typeof netWorthSnapshots>;

function mapNetWorthSnapshotToDomain(
  row: NetWorthSnapshotRow,
): NetWorthSnapshot {
  return new NetWorthSnapshot(
    row.id,
    row.userId,
    new Date(row.snapshotDate),
    Number(row.totalAssets),
    Number(row.totalLiabilities),
    Number(row.netWorth),
    row.currency as Currency,
    row.createdAt ?? new Date(),
    Number(row.version),
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
    currency: entity.currency,
    version: String(entity.version),
  };
}

// Legacy class export for backward compatibility
export const NetWorthSnapshotMapper = {
  toDomain: mapNetWorthSnapshotToDomain,
  toPersistence: mapNetWorthSnapshotToPersistence,
};
