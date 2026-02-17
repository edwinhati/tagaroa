import { Exclude, Expose } from "class-transformer";
import type { Account } from "../../domain/entities/account.entity";

@Exclude()
export class AccountResponseDto {
  @Expose()
  id!: string;

  @Expose()
  name!: string;

  @Expose()
  type!: string;

  @Expose()
  balance!: number;

  @Expose({ name: "user_id" })
  userId!: string;

  @Expose()
  currency!: string;

  @Expose()
  notes!: string | null;

  @Expose({ name: "deleted_at" })
  deletedAt!: Date | null;

  @Expose({ name: "created_at" })
  createdAt!: Date;

  @Expose({ name: "updated_at" })
  updatedAt!: Date;

  @Expose()
  version!: number;

  constructor(partial: Partial<AccountResponseDto>) {
    Object.assign(this, partial);
  }
}

export function toAccountResponse(account: Account): AccountResponseDto {
  return new AccountResponseDto({
    id: account.id,
    name: account.name,
    type: account.type,
    balance: account.balance,
    userId: account.userId,
    currency: account.currency,
    notes: account.notes,
    deletedAt: account.deletedAt,
    createdAt: account.createdAt,
    updatedAt: account.updatedAt,
    version: account.version,
  });
}
