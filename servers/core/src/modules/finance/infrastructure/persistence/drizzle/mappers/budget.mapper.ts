import type { InferSelectModel } from "drizzle-orm";
import { Budget } from "../../../../domain/entities/budget.entity";
import type { budgets } from "../schemas/budget.schema";

type BudgetRow = InferSelectModel<typeof budgets>;

export function mapBudgetToDomain(row: BudgetRow): Budget {
  return new Budget(
    row.id,
    row.month,
    row.year,
    Number(row.amount),
    row.userId,
    row.currency,
    row.deletedAt,
    row.createdAt ?? new Date(),
    row.updatedAt ?? new Date(),
    row.version ?? 1,
  );
}

export function mapBudgetToPersistence(
  entity: Budget,
): Omit<BudgetRow, "createdAt" | "updatedAt"> {
  return {
    id: entity.id,
    month: entity.month,
    year: entity.year,
    amount: String(entity.amount),
    userId: entity.userId,
    currency: entity.currency,
    deletedAt: entity.deletedAt,
    version: entity.version,
  };
}

// Legacy class export for backward compatibility
export const BudgetMapper = {
  toDomain: mapBudgetToDomain,
  toPersistence: mapBudgetToPersistence,
};
