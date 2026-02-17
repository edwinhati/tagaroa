import { Exclude, Expose } from "class-transformer";
import type { Liability } from "../../domain/entities/liability.entity";

@Exclude()
export class LiabilityResponseDto {
  @Expose()
  id!: string;

  @Expose()
  name!: string;

  @Expose()
  type!: string;

  @Expose()
  amount!: number;

  @Expose()
  currency!: string;

  @Expose({ name: "paid_at" })
  paidAt!: Date | null;

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

  constructor(partial: Partial<LiabilityResponseDto>) {
    Object.assign(this, partial);
  }
}

export function toLiabilityResponse(
  liability: Liability,
): LiabilityResponseDto {
  return new LiabilityResponseDto({
    id: liability.id,
    name: liability.name,
    type: liability.type,
    amount: liability.amount,
    currency: liability.currency,
    paidAt: liability.paidAt,
    notes: liability.notes,
    userId: liability.userId,
    deletedAt: liability.deletedAt,
    createdAt: liability.createdAt,
    updatedAt: liability.updatedAt,
    version: liability.version,
  });
}
