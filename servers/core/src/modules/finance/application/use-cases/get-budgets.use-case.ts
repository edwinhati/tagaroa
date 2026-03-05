import { Inject, Injectable } from "@nestjs/common";
import type {
  PaginatedResult,
  PaginationParams,
} from "../../../../shared/types/pagination";
import type { Budget } from "../../domain/entities/budget.entity";
import type { BudgetItem } from "../../domain/entities/budget-item.entity";
import type { IBudgetRepository } from "../../domain/repositories/budget.repository.interface";
import { BUDGET_REPOSITORY } from "../../domain/repositories/budget.repository.interface";
import type { IBudgetItemRepository } from "../../domain/repositories/budget-item.repository.interface";
import { BUDGET_ITEM_REPOSITORY } from "../../domain/repositories/budget-item.repository.interface";

export type BudgetWithItems = {
  budget: Budget;
  items: BudgetItem[];
};

@Injectable()
export class GetBudgetsUseCase {
  @Inject(BUDGET_REPOSITORY)
  private readonly budgetRepository!: IBudgetRepository;
  @Inject(BUDGET_ITEM_REPOSITORY)
  private readonly budgetItemRepository!: IBudgetItemRepository;

  async execute(
    userId: string,
    pagination: PaginationParams,
  ): Promise<PaginatedResult<BudgetWithItems>> {
    const offset = (pagination.page - 1) * pagination.limit;
    const result = await this.budgetRepository.findByUserIdPaginated(
      userId,
      offset,
      pagination.limit,
    );

    const budgetIds = result.items.map((b) => b.id);
    const allItems = await this.budgetItemRepository.findByBudgetIds(budgetIds);

    const itemsByBudgetId = new Map<string, BudgetItem[]>();
    for (const item of allItems) {
      const list = itemsByBudgetId.get(item.budgetId) ?? [];
      list.push(item);
      itemsByBudgetId.set(item.budgetId, list);
    }

    const budgetsWithItems = result.items.map((budget) => ({
      budget,
      items: itemsByBudgetId.get(budget.id) ?? [],
    }));

    return {
      items: budgetsWithItems,
      total: result.total,
    };
  }
}
