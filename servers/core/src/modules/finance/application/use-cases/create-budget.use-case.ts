import { Inject, Injectable } from "@nestjs/common";
import type { BunSQLDatabase } from "drizzle-orm/bun-sql";
import { DRIZZLE } from "../../../../shared/database/database.constants";
import { Budget } from "../../domain/entities/budget.entity";
import { BudgetItem } from "../../domain/entities/budget-item.entity";
import { BudgetAlreadyExistsException } from "../../domain/exceptions/budget.exceptions";
import type { IBudgetRepository } from "../../domain/repositories/budget.repository.interface";
import { BUDGET_REPOSITORY } from "../../domain/repositories/budget.repository.interface";
import { getDefaultCategories } from "../../domain/value-objects/budget-category";
import { BudgetMapper } from "../../infrastructure/persistence/drizzle/mappers/budget.mapper";
import { BudgetItemMapper } from "../../infrastructure/persistence/drizzle/mappers/budget-item.mapper";
import { budgets } from "../../infrastructure/persistence/drizzle/schemas/budget.schema";
import { budgetItems } from "../../infrastructure/persistence/drizzle/schemas/budget-item.schema";
import type { CreateBudgetDto } from "../dtos/create-budget.dto";

@Injectable()
export class CreateBudgetUseCase {
  constructor(
    @Inject(DRIZZLE)
    private readonly db: BunSQLDatabase,
    @Inject(BUDGET_REPOSITORY)
    private readonly budgetRepository: IBudgetRepository,
  ) {}

  async execute(
    dto: CreateBudgetDto,
    userId: string,
  ): Promise<{ budget: Budget; items: BudgetItem[] }> {
    const existing = await this.budgetRepository.findByUserIdAndMonthYear(
      userId,
      dto.month,
      dto.year,
    );
    if (existing) {
      throw new BudgetAlreadyExistsException(dto.month, dto.year);
    }

    const now = new Date();
    const budget = new Budget(
      crypto.randomUUID(),
      dto.month,
      dto.year,
      dto.amount,
      userId,
      dto.currency,
      null,
      now,
      now,
      1,
    );

    const categories = getDefaultCategories();
    const itemEntities = categories.map(
      (cat) =>
        new BudgetItem(
          crypto.randomUUID(),
          budget.id,
          cat.name,
          0,
          0,
          null,
          now,
          now,
        ),
    );

    return this.db.transaction(async (tx) => {
      const [budgetRow] = await tx
        .insert(budgets)
        .values(BudgetMapper.toPersistence(budget))
        .returning();

      const itemRows = await tx
        .insert(budgetItems)
        .values(itemEntities.map(BudgetItemMapper.toPersistence))
        .returning();

      if (!budgetRow) {
        throw new Error("Failed to create budget");
      }
      return {
        budget: BudgetMapper.toDomain(budgetRow),
        items: itemRows.map(BudgetItemMapper.toDomain),
      };
    });
  }
}
