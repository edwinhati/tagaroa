import type {
  InstallmentMetadata,
  Liability,
} from "../../domain/entities/liability.entity";

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
  // Installment-related fields
  transaction_id: string | null;
  installment_number: number | null;
  original_amount: number | null;
  total_interest: number | null;
  total_amount: number | null;
  remaining_months: number | null;
  installment_metadata: InstallmentMetadata | null;
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
    transaction_id: liability.transactionId,
    installment_number: liability.installmentNumber,
    original_amount: liability.originalAmount,
    total_interest: liability.totalInterest,
    total_amount: liability.totalAmount,
    remaining_months: liability.remainingMonths,
    installment_metadata: liability.installmentMetadata,
  };
}
