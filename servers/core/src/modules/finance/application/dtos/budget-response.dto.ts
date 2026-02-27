import type { Budget } from "../../domain/entities/budget.entity";
import type { BudgetItem } from "../../domain/entities/budget-item.entity";

export type BudgetItemResponseDto = {
  id: string;
  allocation: number;
  spent: number;
  budget_id: string;
  category: string;
  deleted_at: Date | null;
  created_at: Date;
  updated_at: Date;
  version: number;
};

export type BudgetResponseDto = {
  id: string;
  month: number;
  year: number;
  amount: number;
  currency: string;
  items: BudgetItemResponseDto[] | null;
  deleted_at: Date | null;
  created_at: Date;
  updated_at: Date;
  version: number;
};

export function toBudgetItemResponse(item: BudgetItem): BudgetItemResponseDto {
  return {
    id: item.id,
    allocation: item.allocation,
    spent: item.spent,
    budget_id: item.budgetId,
    category: item.category,
    deleted_at: item.deletedAt,
    created_at: item.createdAt,
    updated_at: item.updatedAt,
    version: 0,
  };
}

export function toBudgetResponse(
  budget: Budget,
  items: BudgetItem[] | null,
): BudgetResponseDto {
  return {
    id: budget.id,
    month: budget.month,
    year: budget.year,
    amount: budget.amount,
    currency: budget.currency,
    items: items ? items.map(toBudgetItemResponse) : null,
    deleted_at: budget.deletedAt,
    created_at: budget.createdAt,
    updated_at: budget.updatedAt,
    version: budget.version,
  };
}
