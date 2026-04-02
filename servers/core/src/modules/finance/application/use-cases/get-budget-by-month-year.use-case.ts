import { Inject, Injectable } from "@nestjs/common";
import type { Budget } from "../../domain/entities/budget.entity";
import type { BudgetItem } from "../../domain/entities/budget-item.entity";
import type { IBudgetRepository } from "../../domain/repositories/budget.repository.interface";
import { BUDGET_REPOSITORY } from "../../domain/repositories/budget.repository.interface";
import type { IBudgetItemRepository } from "../../domain/repositories/budget-item.repository.interface";
import { BUDGET_ITEM_REPOSITORY } from "../../domain/repositories/budget-item.repository.interface";

type BudgetWithItems = {
  budget: Budget;
  items: BudgetItem[];
};

@Injectable()
export class GetBudgetByMonthYearUseCase {
  constructor(
    @Inject(BUDGET_REPOSITORY)
    private readonly budgetRepository: IBudgetRepository,
    @Inject(BUDGET_ITEM_REPOSITORY)
    private readonly budgetItemRepository: IBudgetItemRepository,
  ) {}

  async execute(
    userId: string,
    month: number,
    year: number,
  ): Promise<BudgetWithItems | null> {
    const budget = await this.budgetRepository.findByUserIdAndMonthYear(
      userId,
      month,
      year,
    );

    if (!budget) return null;

    const items = await this.budgetItemRepository.findByBudgetId(budget.id);
    return { budget, items };
  }
}
