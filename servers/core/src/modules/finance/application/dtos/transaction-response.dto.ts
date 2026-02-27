import type { Account } from "../../domain/entities/account.entity";
import type { BudgetItem } from "../../domain/entities/budget-item.entity";
import type { Transaction } from "../../domain/entities/transaction.entity";
import type { Currency } from "../../domain/value-objects/currency";
import type { TransactionType } from "../../domain/value-objects/transaction-type";

export type TransactionAccountDto = {
  id: string;
  name: string;
  type: string;
  balance: number;
  currency: string;
};

export type TransactionBudgetItemDto = {
  id: string;
  allocation: number;
  category: string;
};

export type TransactionResponseDto = {
  id: string;
  amount: number;
  date: Date;
  notes: string | null;
  currency: Currency;
  type: TransactionType;
  files: string[] | null;
  user_id: string;
  account_id: string;
  budget_item_id: string | null;
  account?: TransactionAccountDto;
  budget_item?: TransactionBudgetItemDto;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
  version: number;
};

export function toTransactionAccountDto(
  account: Account,
): TransactionAccountDto {
  return {
    id: account.id,
    name: account.name,
    type: account.type,
    balance: account.balance,
    currency: account.currency,
  };
}

export function toTransactionBudgetItemDto(
  item: BudgetItem,
): TransactionBudgetItemDto {
  return {
    id: item.id,
    allocation: item.allocation,
    category: item.category,
  };
}

export function toTransactionResponse(
  transaction: Transaction,
  account?: Account,
  budgetItem?: BudgetItem,
): TransactionResponseDto {
  return {
    id: transaction.id,
    amount: transaction.amount,
    date: transaction.date,
    notes: transaction.notes,
    currency: transaction.currency,
    type: transaction.type,
    files: transaction.files,
    user_id: transaction.userId,
    account_id: transaction.accountId,
    budget_item_id: transaction.budgetItemId,
    account: account ? toTransactionAccountDto(account) : undefined,
    budget_item: budgetItem
      ? toTransactionBudgetItemDto(budgetItem)
      : undefined,
    created_at: transaction.createdAt,
    updated_at: transaction.updatedAt,
    deleted_at: transaction.deletedAt,
    version: transaction.version,
  };
}
