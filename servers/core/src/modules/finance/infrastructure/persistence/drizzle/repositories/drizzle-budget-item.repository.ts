import { and, eq, inArray, isNull } from "drizzle-orm";
import { DrizzleBaseRepository } from "../../../../../../shared/database/drizzle-base.repository";
import type { BudgetItem } from "../../../../domain/entities/budget-item.entity";
import type { IBudgetItemRepository } from "../../../../domain/repositories/budget-item.repository.interface";
import { BudgetItemMapper } from "../mappers/budget-item.mapper";
import { budgetItems } from "../schemas/budget-item.schema";

export class DrizzleBudgetItemRepository
  extends DrizzleBaseRepository
  implements IBudgetItemRepository
{
  async findById(id: string): Promise<BudgetItem | null> {
    const [row] = await this.getDb()
      .select()
      .from(budgetItems)
      .where(and(eq(budgetItems.id, id), isNull(budgetItems.deletedAt)))
      .limit(1);

    return row ? BudgetItemMapper.toDomain(row) : null;
  }

  async findByIds(ids: string[]): Promise<BudgetItem[]> {
    if (ids.length === 0) return [];

    const rows = await this.getDb()
      .select()
      .from(budgetItems)
      .where(and(inArray(budgetItems.id, ids), isNull(budgetItems.deletedAt)));

    return rows.map(BudgetItemMapper.toDomain);
  }

  async findByBudgetId(budgetId: string): Promise<BudgetItem[]> {
    const rows = await this.getDb()
      .select()
      .from(budgetItems)
      .where(
        and(eq(budgetItems.budgetId, budgetId), isNull(budgetItems.deletedAt)),
      );

    return rows.map(BudgetItemMapper.toDomain);
  }

  async findByBudgetIds(budgetIds: string[]): Promise<BudgetItem[]> {
    if (budgetIds.length === 0) return [];

    const rows = await this.getDb()
      .select()
      .from(budgetItems)
      .where(
        and(
          inArray(budgetItems.budgetId, budgetIds),
          isNull(budgetItems.deletedAt),
        ),
      );

    return rows.map(BudgetItemMapper.toDomain);
  }

  async create(budgetItem: BudgetItem): Promise<BudgetItem> {
    const [row] = await this.getDb()
      .insert(budgetItems)
      .values(BudgetItemMapper.toPersistence(budgetItem))
      .returning();

    if (!row) {
      throw new Error("Failed to create budget item");
    }
    return BudgetItemMapper.toDomain(row);
  }

  async createMany(items: BudgetItem[]): Promise<BudgetItem[]> {
    if (items.length === 0) return [];

    const rows = await this.getDb()
      .insert(budgetItems)
      .values(items.map(BudgetItemMapper.toPersistence))
      .returning();

    return rows.map(BudgetItemMapper.toDomain);
  }

  async update(budgetItem: BudgetItem): Promise<BudgetItem> {
    const [row] = await this.getDb()
      .update(budgetItems)
      .set(BudgetItemMapper.toPersistence(budgetItem))
      .where(eq(budgetItems.id, budgetItem.id))
      .returning();

    if (!row) {
      throw new Error("Failed to update budget item");
    }
    return BudgetItemMapper.toDomain(row);
  }

  async delete(id: string): Promise<void> {
    await this.getDb()
      .update(budgetItems)
      .set({ deletedAt: new Date() })
      .where(eq(budgetItems.id, id));
  }

  async deleteByBudgetId(budgetId: string): Promise<void> {
    await this.getDb()
      .update(budgetItems)
      .set({ deletedAt: new Date() })
      .where(eq(budgetItems.budgetId, budgetId));
  }
}
