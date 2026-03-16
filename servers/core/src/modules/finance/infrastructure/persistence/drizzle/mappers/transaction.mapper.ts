import type { InferSelectModel } from "drizzle-orm";
import {
  type InstallmentData,
  Transaction,
} from "../../../../domain/entities/transaction.entity";
import type { Currency } from "../../../../domain/value-objects/currency";
import type { TransactionType } from "../../../../domain/value-objects/transaction-type";
import type { transactions } from "../schemas/transaction.schema";

type TransactionRow = InferSelectModel<typeof transactions>;

export function mapTransactionToDomain(row: TransactionRow): Transaction {
  return new Transaction(
    row.id,
    Number(row.amount),
    new Date(row.date),
    row.notes,
    row.currency as Currency,
    row.type as TransactionType,
    row.files,
    row.userId,
    row.accountId,
    row.budgetItemId,
    row.deletedAt,
    row.createdAt ?? new Date(),
    row.updatedAt ?? new Date(),
    row.version ?? 1,
    row.installment as InstallmentData | null,
  );
}

export function mapTransactionToPersistence(
  entity: Transaction,
): Omit<TransactionRow, "createdAt" | "updatedAt"> {
  const dateStr = entity.date.toISOString().split("T")[0];
  return {
    id: entity.id,
    amount: String(entity.amount),
    date: dateStr ?? entity.date.toISOString().slice(0, 10),
    notes: entity.notes,
    currency: entity.currency,
    type: entity.type,
    files: entity.files,
    userId: entity.userId,
    accountId: entity.accountId,
    budgetItemId: entity.budgetItemId,
    deletedAt: entity.deletedAt,
    version: entity.version,
    installment: entity.installment,
  };
}

// Legacy class export for backward compatibility
export const TransactionMapper = {
  toDomain: mapTransactionToDomain,
  toPersistence: mapTransactionToPersistence,
};
