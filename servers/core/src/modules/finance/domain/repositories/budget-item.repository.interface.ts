import type { BudgetItem } from "../entities/budget-item.entity";

export const BUDGET_ITEM_REPOSITORY = Symbol("BUDGET_ITEM_REPOSITORY");

export interface IBudgetItemRepository {
  findById(id: string): Promise<BudgetItem | null>;
  findByIds(ids: string[]): Promise<BudgetItem[]>;
  findByBudgetId(budgetId: string): Promise<BudgetItem[]>;
  findByBudgetIds(budgetIds: string[]): Promise<BudgetItem[]>;
  create(budgetItem: BudgetItem): Promise<BudgetItem>;
  createMany(budgetItems: BudgetItem[]): Promise<BudgetItem[]>;
  update(budgetItem: BudgetItem): Promise<BudgetItem>;
  delete(id: string): Promise<void>;
  deleteByBudgetId(budgetId: string): Promise<void>;
}
