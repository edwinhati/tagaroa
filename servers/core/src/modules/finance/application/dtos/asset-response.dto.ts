import type { Asset } from "../../domain/entities/asset.entity";

export type AssetResponseDto = {
  id: string;
  name: string;
  type: string;
  value: number;
  shares: number | null;
  ticker: string | null;
  currency: string;
  notes: string | null;
  user_id: string;
  deleted_at: Date | null;
  created_at: Date;
  updated_at: Date;
  version: number;
};

export function toAssetResponse(asset: Asset): AssetResponseDto {
  return {
    id: asset.id,
    name: asset.name,
    type: asset.type,
    value: asset.value,
    shares: asset.shares,
    ticker: asset.ticker,
    currency: asset.currency,
    notes: asset.notes,
    user_id: asset.userId,
    deleted_at: asset.deletedAt,
    created_at: asset.createdAt,
    updated_at: asset.updatedAt,
    version: asset.version,
  };
}
