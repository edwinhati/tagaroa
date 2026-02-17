import { Exclude, Expose } from "class-transformer";
import type { Asset } from "../../domain/entities/asset.entity";

@Exclude()
export class AssetResponseDto {
  @Expose()
  id!: string;

  @Expose()
  name!: string;

  @Expose()
  type!: string;

  @Expose()
  value!: number;

  @Expose()
  shares!: number | null;

  @Expose()
  ticker!: string | null;

  @Expose()
  currency!: string;

  @Expose()
  notes!: string | null;

  @Expose({ name: "user_id" })
  userId!: string;

  @Expose({ name: "deleted_at" })
  deletedAt!: Date | null;

  @Expose({ name: "created_at" })
  createdAt!: Date;

  @Expose({ name: "updated_at" })
  updatedAt!: Date;

  @Expose()
  version!: number;

  constructor(partial: Partial<AssetResponseDto>) {
    Object.assign(this, partial);
  }
}

export function toAssetResponse(asset: Asset): AssetResponseDto {
  return new AssetResponseDto({
    id: asset.id,
    name: asset.name,
    type: asset.type,
    value: asset.value,
    shares: asset.shares,
    ticker: asset.ticker,
    currency: asset.currency,
    notes: asset.notes,
    userId: asset.userId,
    deletedAt: asset.deletedAt,
    createdAt: asset.createdAt,
    updatedAt: asset.updatedAt,
    version: asset.version,
  });
}
