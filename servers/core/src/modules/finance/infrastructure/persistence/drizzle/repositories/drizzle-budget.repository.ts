import { and, count, eq, isNull } from "drizzle-orm";
import { DrizzleBaseRepository } from "../../../../../../shared/database/drizzle-base.repository";
import { ConcurrentModificationException } from "../../../../../../shared/exceptions/domain.exception";
import type { PaginatedResult } from "../../../../../../shared/types/pagination";
import type { Budget } from "../../../../domain/entities/budget.entity";
import type { IBudgetRepository } from "../../../../domain/repositories/budget.repository.interface";
import { BudgetMapper } from "../mappers/budget.mapper";
import { budgets } from "../schemas/budget.schema";

export class DrizzleBudgetRepository
  extends DrizzleBaseRepository
  implements IBudgetRepository
{
  async findById(id: string): Promise<Budget | null> {
    const [row] = await this.getDb()
      .select()
      .from(budgets)
      .where(and(eq(budgets.id, id), isNull(budgets.deletedAt)))
      .limit(1);

    return row ? BudgetMapper.toDomain(row) : null;
  }

  async findByUserId(userId: string): Promise<Budget[]> {
    const rows = await this.getDb()
      .select()
      .from(budgets)
      .where(and(eq(budgets.userId, userId), isNull(budgets.deletedAt)));

    return rows.map(BudgetMapper.toDomain);
  }

  async findByUserIdPaginated(
    userId: string,
    offset: number,
    limit: number,
  ): Promise<PaginatedResult<Budget>> {
    const where = and(eq(budgets.userId, userId), isNull(budgets.deletedAt));
    const [rows, countResult] = await Promise.all([
      this.getDb()
        .select()
        .from(budgets)
        .where(where)
        .limit(limit)
        .offset(offset),
      this.getDb().select({ total: count() }).from(budgets).where(where),
    ]);
    const total = countResult[0]?.total ?? 0;

    return {
      items: rows.map(BudgetMapper.toDomain),
      total,
    };
  }

  async findByUserIdAndMonthYear(
    userId: string,
    month: number,
    year: number,
  ): Promise<Budget | null> {
    const [row] = await this.getDb()
      .select()
      .from(budgets)
      .where(
        and(
          eq(budgets.userId, userId),
          eq(budgets.month, month),
          eq(budgets.year, year),
          isNull(budgets.deletedAt),
        ),
      )
      .limit(1);

    return row ? BudgetMapper.toDomain(row) : null;
  }

  async create(budget: Budget): Promise<Budget> {
    const [row] = await this.getDb()
      .insert(budgets)
      .values(BudgetMapper.toPersistence(budget))
      .returning();

    if (!row) {
      throw new Error("Failed to create budget");
    }
    return BudgetMapper.toDomain(row);
  }

  async update(budget: Budget): Promise<Budget> {
    const data = BudgetMapper.toPersistence(budget);
    const [row] = await this.getDb()
      .update(budgets)
      .set({ ...data, version: (budget.version ?? 0) + 1 })
      .where(
        and(eq(budgets.id, budget.id), eq(budgets.version, budget.version)),
      )
      .returning();

    if (!row) {
      throw new ConcurrentModificationException("Budget", budget.id);
    }

    return BudgetMapper.toDomain(row);
  }

  async delete(id: string): Promise<void> {
    await this.getDb()
      .update(budgets)
      .set({ deletedAt: new Date() })
      .where(eq(budgets.id, id));
  }
}
