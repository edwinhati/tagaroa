import type { PaginatedResult } from "../../../../../shared/types/pagination";
import type { Portfolio } from "../entities/portfolio.entity";

export const PORTFOLIO_REPOSITORY = Symbol("PORTFOLIO_REPOSITORY");

export interface IPortfolioRepository {
  findById(id: string): Promise<Portfolio | null>;
  findByUserId(userId: string): Promise<Portfolio[]>;
  findByUserIdPaginated(
    userId: string,
    offset: number,
    limit: number,
  ): Promise<PaginatedResult<Portfolio>>;
  findAllActive(): Promise<Portfolio[]>;
  create(portfolio: Portfolio): Promise<Portfolio>;
  update(portfolio: Portfolio): Promise<Portfolio>;
  delete(id: string): Promise<void>;
}
