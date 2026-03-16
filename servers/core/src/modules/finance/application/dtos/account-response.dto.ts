import type { Account } from "../../domain/entities/account.entity";
import type { AccountCategory } from "../../domain/value-objects/account-category";
import type { AccountMetadata } from "../../domain/value-objects/credit-metadata";

export type AccountResponseDto = {
  id: string;
  name: string;
  type: string;
  category: AccountCategory;
  balance: number;
  user_id: string;
  currency: string;
  notes: string | null;
  metadata: AccountMetadata | null;
  deleted_at: Date | null;
  created_at: Date;
  updated_at: Date;
  version: number;
  // Computed fields for credit accounts
  available_credit?: number | null;
  credit_utilization?: number | null;
};

export function toAccountResponse(account: Account): AccountResponseDto {
  const response: AccountResponseDto = {
    id: account.id,
    name: account.name,
    type: account.type,
    category: account.category,
    balance: account.balance,
    user_id: account.userId,
    currency: account.currency,
    notes: account.notes,
    metadata: account.metadata,
    deleted_at: account.deletedAt,
    created_at: account.createdAt,
    updated_at: account.updatedAt,
    version: account.version,
  };

  // Add computed credit fields for liability accounts
  if (account.isLiability()) {
    response.available_credit = account.getAvailableCredit();
    response.credit_utilization = account.getCreditUtilization();
  }

  return response;
}
