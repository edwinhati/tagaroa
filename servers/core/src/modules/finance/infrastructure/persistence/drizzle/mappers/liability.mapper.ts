import type { InferSelectModel } from "drizzle-orm";
import {
  type InstallmentMetadata,
  Liability,
} from "../../../../domain/entities/liability.entity";
import type { Currency } from "../../../../domain/value-objects/currency";
import type { liabilities } from "../schemas/liability.schema";

type LiabilityRow = InferSelectModel<typeof liabilities>;

function mapLiabilityToDomain(row: LiabilityRow): Liability {
  return new Liability(
    row.id,
    row.userId,
    row.name,
    row.type,
    Number(row.amount),
    row.currency as Currency,
    row.paidAt,
    row.notes,
    row.deletedAt,
    row.createdAt ?? new Date(),
    row.updatedAt ?? new Date(),
    row.version ?? 1,
    row.transactionId,
    row.installmentNumber,
    row.originalAmount ? Number(row.originalAmount) : null,
    row.totalInterest ? Number(row.totalInterest) : null,
    row.totalAmount ? Number(row.totalAmount) : null,
    row.remainingMonths,
    row.installmentMetadata as InstallmentMetadata | null,
    row.dueAt,
  );
}

function mapLiabilityToPersistence(
  entity: Liability,
): Omit<LiabilityRow, "createdAt" | "updatedAt"> {
  return {
    id: entity.id,
    userId: entity.userId,
    name: entity.name,
    type: entity.type,
    amount: String(entity.amount),
    currency: entity.currency,
    paidAt: entity.paidAt,
    notes: entity.notes,
    deletedAt: entity.deletedAt,
    version: entity.version,
    transactionId: entity.transactionId,
    installmentNumber: entity.installmentNumber,
    originalAmount:
      entity.originalAmount === null ? null : String(entity.originalAmount),
    totalInterest:
      entity.totalInterest === null ? null : String(entity.totalInterest),
    totalAmount:
      entity.totalAmount === null ? null : String(entity.totalAmount),
    remainingMonths: entity.remainingMonths,
    installmentMetadata: entity.installmentMetadata,
    dueAt: entity.dueAt,
  };
}

// Legacy class export for backward compatibility
export const LiabilityMapper = {
  toDomain: mapLiabilityToDomain,
  toPersistence: mapLiabilityToPersistence,
};
