import { Exclude, Expose } from "class-transformer";
import type { Budget } from "../../domain/entities/budget.entity";
import type { BudgetItem } from "../../domain/entities/budget-item.entity";

@Exclude()
export class BudgetItemResponseDto {
  @Expose()
  id!: string;

  @Expose()
  allocation!: number;

  @Expose()
  spent!: number;

  @Expose({ name: "budget_id" })
  budgetId!: string;

  @Expose()
  category!: string;

  @Expose({ name: "deleted_at" })
  deletedAt!: Date | null;

  @Expose({ name: "created_at" })
  createdAt!: Date;

  @Expose({ name: "updated_at" })
  updatedAt!: Date;

  @Expose()
  version!: number;

  constructor(partial: Partial<BudgetItemResponseDto>) {
    Object.assign(this, partial);
  }
}

@Exclude()
export class BudgetResponseDto {
  @Expose()
  id!: string;

  @Expose()
  month!: number;

  @Expose()
  year!: number;

  @Expose()
  amount!: number;

  @Expose()
  currency!: string;

  @Expose()
  items!: BudgetItemResponseDto[] | null;

  @Expose({ name: "deleted_at" })
  deletedAt!: Date | null;

  @Expose({ name: "created_at" })
  createdAt!: Date;

  @Expose({ name: "updated_at" })
  updatedAt!: Date;

  @Expose()
  version!: number;

  constructor(partial: Partial<BudgetResponseDto>) {
    Object.assign(this, partial);
  }
}

export function toBudgetItemResponse(item: BudgetItem): BudgetItemResponseDto {
  return new BudgetItemResponseDto({
    id: item.id,
    allocation: item.allocation,
    spent: item.spent,
    budgetId: item.budgetId,
    category: item.category,
    deletedAt: item.deletedAt,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    version: 0,
  });
}

export function toBudgetResponse(
  budget: Budget,
  items: BudgetItem[] | null,
): BudgetResponseDto {
  return new BudgetResponseDto({
    id: budget.id,
    month: budget.month,
    year: budget.year,
    amount: budget.amount,
    currency: budget.currency,
    items: items ? items.map(toBudgetItemResponse) : null,
    deletedAt: budget.deletedAt,
    createdAt: budget.createdAt,
    updatedAt: budget.updatedAt,
    version: budget.version,
  });
}
