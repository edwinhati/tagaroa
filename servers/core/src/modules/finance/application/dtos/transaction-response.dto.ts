import { Exclude, Expose, Type } from "class-transformer";
import { Currency } from "../../domain/value-objects/currency";
import { TransactionType } from "../../domain/value-objects/transaction-type";

@Exclude()
export class TransactionAccountDto {
  @Expose()
  id!: string;

  @Expose()
  name!: string;

  @Expose()
  type!: string;

  @Expose()
  balance!: number;

  @Expose()
  currency!: string;

  constructor(partial: Partial<TransactionAccountDto>) {
    Object.assign(this, partial);
  }
}

@Exclude()
export class TransactionBudgetItemDto {
  @Expose()
  id!: string;

  @Expose()
  allocation!: number;

  @Expose()
  category!: string;

  constructor(partial: Partial<TransactionBudgetItemDto>) {
    Object.assign(this, partial);
  }
}

@Exclude()
export class TransactionResponseDto {
  @Expose()
  id!: string;

  @Expose()
  amount!: number;

  @Expose()
  date!: Date;

  @Expose()
  notes!: string | null;

  @Expose()
  currency!: Currency;

  @Expose()
  type!: TransactionType;

  @Expose()
  files!: string[] | null;

  @Expose({ name: "user_id" })
  userId!: string;

  @Expose({ name: "account_id" })
  accountId!: string;

  @Expose({ name: "budget_item_id" })
  budgetItemId!: string | null;

  @Expose()
  @Type(() => TransactionAccountDto)
  account?: TransactionAccountDto;

  @Expose({ name: "budget_item" })
  @Type(() => TransactionBudgetItemDto)
  budgetItem?: TransactionBudgetItemDto;

  @Expose({ name: "created_at" })
  createdAt!: Date;

  @Expose({ name: "updated_at" })
  updatedAt!: Date;

  @Expose({ name: "deleted_at" })
  deletedAt!: Date | null;

  @Expose()
  version!: number;

  constructor(partial: Partial<TransactionResponseDto>) {
    Object.assign(this, partial);
  }
}

import type { Account } from "../../domain/entities/account.entity";
import type { BudgetItem } from "../../domain/entities/budget-item.entity";
import type { Transaction } from "../../domain/entities/transaction.entity";

export function toTransactionAccountDto(
  account: Account,
): TransactionAccountDto {
  return new TransactionAccountDto({
    id: account.id,
    name: account.name,
    type: account.type,
    balance: account.balance,
    currency: account.currency,
  });
}

export function toTransactionBudgetItemDto(
  item: BudgetItem,
): TransactionBudgetItemDto {
  return new TransactionBudgetItemDto({
    id: item.id,
    allocation: item.allocation,
    category: item.category,
  });
}

export function toTransactionResponse(
  transaction: Transaction,
  account?: Account,
  budgetItem?: BudgetItem,
): TransactionResponseDto {
  return new TransactionResponseDto({
    id: transaction.id,
    amount: transaction.amount,
    date: transaction.date,
    notes: transaction.notes,
    currency: transaction.currency,
    type: transaction.type,
    files: transaction.files,
    userId: transaction.userId,
    accountId: transaction.accountId,
    budgetItemId: transaction.budgetItemId,
    account: account ? toTransactionAccountDto(account) : undefined,
    budgetItem: budgetItem ? toTransactionBudgetItemDto(budgetItem) : undefined,
    createdAt: transaction.createdAt,
    updatedAt: transaction.updatedAt,
    deletedAt: transaction.deletedAt,
    version: transaction.version,
  });
}
