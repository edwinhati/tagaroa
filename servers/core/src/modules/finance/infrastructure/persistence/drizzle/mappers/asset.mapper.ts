import type { InferSelectModel } from "drizzle-orm";
import { Asset } from "../../../../domain/entities/asset.entity";
import { Currency } from "../../../../domain/value-objects/currency";
import type { assets } from "../schemas/asset.schema";

type AssetRow = InferSelectModel<typeof assets>;

export function mapAssetToDomain(row: AssetRow): Asset {
  return new Asset(
    row.id,
    row.userId,
    row.name,
    row.type,
    Number(row.value),
    row.shares ? Number(row.shares) : null,
    row.ticker,
    row.currency as Currency,
    row.notes,
    row.deletedAt,
    row.createdAt ?? new Date(),
    row.updatedAt ?? new Date(),
    row.version ?? 1,
  );
}

export function mapAssetToPersistence(
  entity: Asset,
): Omit<AssetRow, "createdAt" | "updatedAt"> {
  return {
    id: entity.id,
    userId: entity.userId,
    name: entity.name,
    type: entity.type,
    value: String(entity.value),
    shares: entity.shares !== null ? String(entity.shares) : null,
    ticker: entity.ticker,
    currency: entity.currency,
    notes: entity.notes,
    deletedAt: entity.deletedAt,
    version: entity.version,
  };
}

// Legacy class export for backward compatibility
export const AssetMapper = {
  toDomain: mapAssetToDomain,
  toPersistence: mapAssetToPersistence,
};
