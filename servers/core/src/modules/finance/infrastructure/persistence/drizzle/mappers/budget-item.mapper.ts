import type { InferSelectModel } from "drizzle-orm";
import { BudgetItem } from "../../../../domain/entities/budget-item.entity";
import type { budgetItems } from "../schemas/budget-item.schema";

type BudgetItemRow = InferSelectModel<typeof budgetItems>;

export function mapBudgetItemToDomain(row: BudgetItemRow): BudgetItem {
  return new BudgetItem(
    row.id,
    row.budgetId,
    row.category,
    Number(row.allocation),
    Number(row.spent),
    row.deletedAt,
    row.createdAt ?? new Date(),
    row.updatedAt ?? new Date(),
  );
}

export function mapBudgetItemToPersistence(
  entity: BudgetItem,
): Omit<BudgetItemRow, "createdAt" | "updatedAt"> {
  return {
    id: entity.id,
    budgetId: entity.budgetId,
    category: entity.category,
    allocation: String(entity.allocation),
    spent: String(entity.spent),
    deletedAt: entity.deletedAt,
  };
}

// Legacy class export for backward compatibility
export const BudgetItemMapper = {
  toDomain: mapBudgetItemToDomain,
  toPersistence: mapBudgetItemToPersistence,
};
