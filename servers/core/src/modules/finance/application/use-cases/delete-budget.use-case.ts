import { Inject, Injectable } from "@nestjs/common";
import {
  BudgetAccessDeniedException,
  BudgetNotFoundException,
} from "../../domain/exceptions/budget.exceptions";
import type { IBudgetRepository } from "../../domain/repositories/budget.repository.interface";
import { BUDGET_REPOSITORY } from "../../domain/repositories/budget.repository.interface";
import {
  BUDGET_ITEM_REPOSITORY,
  type IBudgetItemRepository,
} from "../../domain/repositories/budget-item.repository.interface";

@Injectable()
export class DeleteBudgetUseCase {
  @Inject(BUDGET_REPOSITORY)
  private readonly budgetRepository!: IBudgetRepository;
  @Inject(BUDGET_ITEM_REPOSITORY)
  private readonly budgetItemRepository!: IBudgetItemRepository;

  async execute(id: string, userId: string): Promise<void> {
    const budget = await this.budgetRepository.findById(id);

    if (!budget) {
      throw new BudgetNotFoundException(id);
    }

    if (budget.userId !== userId) {
      throw new BudgetAccessDeniedException();
    }

    // Soft delete budget
    await this.budgetRepository.delete(id);

    // Cascade soft delete to all budget items
    await this.budgetItemRepository.deleteByBudgetId(id);
  }
}
