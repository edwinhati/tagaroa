import type { InferSelectModel } from "drizzle-orm";
import { NetWorthSnapshot } from "../../../../domain/entities/net-worth-snapshot.entity";
import { Currency } from "../../../../domain/value-objects/currency";
import type { netWorthSnapshots } from "../schemas/net-worth-snapshot.schema";

type NetWorthSnapshotRow = InferSelectModel<typeof netWorthSnapshots>;

export function mapNetWorthSnapshotToDomain(
  row: NetWorthSnapshotRow,
): NetWorthSnapshot {
  return new NetWorthSnapshot(
    row.id,
    row.userId,
    new Date(row.snapshotDate),
    Number(row.totalAssets),
    Number(row.totalLiabilities),
    Number(row.netWorth),
    new Currency(row.currency),
    row.createdAt ?? new Date(),
  );
}

export function mapNetWorthSnapshotToPersistence(
  entity: NetWorthSnapshot,
): Omit<NetWorthSnapshotRow, "createdAt"> {
  return {
    id: entity.id,
    userId: entity.userId,
    snapshotDate: entity.snapshotDate.toISOString().split("T")[0],
    totalAssets: String(entity.totalAssets),
    totalLiabilities: String(entity.totalLiabilities),
    netWorth: String(entity.netWorth),
    currency: entity.currency.code,
  };
}

// Legacy class export for backward compatibility
export const NetWorthSnapshotMapper = {
  toDomain: mapNetWorthSnapshotToDomain,
  toPersistence: mapNetWorthSnapshotToPersistence,
};
