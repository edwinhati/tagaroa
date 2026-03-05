import type { PaginatedResult } from "../../../../shared/types/pagination";
import type { Budget } from "../entities/budget.entity";

export const BUDGET_REPOSITORY = Symbol("BUDGET_REPOSITORY");

export interface IBudgetRepository {
  findById(id: string): Promise<Budget | null>;
  findByUserId(userId: string): Promise<Budget[]>;
  findByUserIdPaginated(
    userId: string,
    offset: number,
    limit: number,
  ): Promise<PaginatedResult<Budget>>;
  findByUserIdAndMonthYear(
    userId: string,
    month: number,
    year: number,
  ): Promise<Budget | null>;
  create(budget: Budget): Promise<Budget>;
  update(budget: Budget): Promise<Budget>;
  delete(id: string): Promise<void>;
}
