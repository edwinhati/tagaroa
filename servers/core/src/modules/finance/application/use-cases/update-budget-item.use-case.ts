import { Inject, Injectable } from "@nestjs/common";
import { BudgetItem } from "../../domain/entities/budget-item.entity";
import {
  BudgetAccessDeniedException,
  BudgetAllocationExceededException,
  BudgetItemNotFoundException,
  BudgetNotFoundException,
} from "../../domain/exceptions/budget.exceptions";
import type { IBudgetRepository } from "../../domain/repositories/budget.repository.interface";
import { BUDGET_REPOSITORY } from "../../domain/repositories/budget.repository.interface";
import type { IBudgetItemRepository } from "../../domain/repositories/budget-item.repository.interface";
import { BUDGET_ITEM_REPOSITORY } from "../../domain/repositories/budget-item.repository.interface";
import type { UpdateBudgetItemDto } from "../dtos/update-budget-item.dto";

@Injectable()
export class UpdateBudgetItemUseCase {
  @Inject(BUDGET_REPOSITORY)
  private readonly budgetRepository!: IBudgetRepository;
  @Inject(BUDGET_ITEM_REPOSITORY)
  private readonly budgetItemRepository!: IBudgetItemRepository;

  async execute(
    itemId: string,
    dto: UpdateBudgetItemDto,
    userId: string,
  ): Promise<BudgetItem> {
    // Verify budget ownership
    const budget = await this.budgetRepository.findById(dto.budgetId);
    if (!budget) {
      throw new BudgetNotFoundException(dto.budgetId);
    }
    if (budget.userId !== userId) {
      throw new BudgetAccessDeniedException();
    }

    const existing = await this.budgetItemRepository.findById(itemId);
    if (!existing) {
      throw new BudgetItemNotFoundException(itemId);
    }

    // Validate that total allocations don't exceed budget amount
    const allBudgetItems = await this.budgetItemRepository.findByBudgetId(
      dto.budgetId,
    );
    const totalAllocations = allBudgetItems.reduce((sum, item) => {
      // Use new allocation for this item, existing allocation for others
      return sum + (item.id === itemId ? dto.allocation : item.allocation);
    }, 0);

    if (totalAllocations > budget.amount) {
      throw new BudgetAllocationExceededException(
        totalAllocations,
        budget.amount,
      );
    }

    const updated = new BudgetItem(
      existing.id,
      existing.budgetId,
      existing.category,
      dto.allocation,
      existing.spent,
      existing.deletedAt,
      existing.createdAt,
      new Date(),
    );

    return this.budgetItemRepository.update(updated);
  }
}
