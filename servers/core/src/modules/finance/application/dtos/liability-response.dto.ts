import type { Liability } from "../../domain/entities/liability.entity";

export type LiabilityResponseDto = {
  id: string;
  name: string;
  type: string;
  amount: number;
  currency: string;
  paid_at: Date | null;
  notes: string | null;
  user_id: string;
  deleted_at: Date | null;
  created_at: Date;
  updated_at: Date;
  version: number;
};

export function toLiabilityResponse(
  liability: Liability,
): LiabilityResponseDto {
  return {
    id: liability.id,
    name: liability.name,
    type: liability.type,
    amount: liability.amount,
    currency: liability.currency,
    paid_at: liability.paidAt,
    notes: liability.notes,
    user_id: liability.userId,
    deleted_at: liability.deletedAt,
    created_at: liability.createdAt,
    updated_at: liability.updatedAt,
    version: liability.version,
  };
}
