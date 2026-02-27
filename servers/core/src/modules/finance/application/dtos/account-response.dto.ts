import type { Account } from "../../domain/entities/account.entity";

export type AccountResponseDto = {
  id: string;
  name: string;
  type: string;
  balance: number;
  user_id: string;
  currency: string;
  notes: string | null;
  deleted_at: Date | null;
  created_at: Date;
  updated_at: Date;
  version: number;
};

export function toAccountResponse(account: Account): AccountResponseDto {
  return {
    id: account.id,
    name: account.name,
    type: account.type,
    balance: account.balance,
    user_id: account.userId,
    currency: account.currency,
    notes: account.notes,
    deleted_at: account.deletedAt,
    created_at: account.createdAt,
    updated_at: account.updatedAt,
    version: account.version,
  };
}
