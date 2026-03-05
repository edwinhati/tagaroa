import { Inject, Injectable } from "@nestjs/common";
import { Budget } from "../../domain/entities/budget.entity";
import {
  BudgetAccessDeniedException,
  BudgetNotFoundException,
} from "../../domain/exceptions/budget.exceptions";
import type { IBudgetRepository } from "../../domain/repositories/budget.repository.interface";
import { BUDGET_REPOSITORY } from "../../domain/repositories/budget.repository.interface";
import type { UpdateBudgetDto } from "../dtos/update-budget.dto";

@Injectable()
export class UpdateBudgetUseCase {
  @Inject(BUDGET_REPOSITORY)
  private readonly budgetRepository!: IBudgetRepository;

  async execute(
    id: string,
    dto: UpdateBudgetDto,
    userId: string,
  ): Promise<Budget> {
    const existing = await this.budgetRepository.findById(id);

    if (!existing) {
      throw new BudgetNotFoundException(id);
    }

    if (existing.userId !== userId) {
      throw new BudgetAccessDeniedException();
    }

    const updated = new Budget(
      existing.id,
      existing.month,
      existing.year,
      dto.amount ?? existing.amount,
      existing.userId,
      existing.currency,
      existing.deletedAt,
      existing.createdAt,
      new Date(),
      existing.version,
    );

    return this.budgetRepository.update(updated);
  }
}
