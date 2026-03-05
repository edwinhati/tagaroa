import { Inject, Injectable } from "@nestjs/common";
import type {
  PaginatedResult,
  PaginationParams,
} from "../../../../../shared/types/pagination";
import type { Portfolio } from "../../../domain/portfolio/entities/portfolio.entity";
import {
  type IPortfolioRepository,
  PORTFOLIO_REPOSITORY,
} from "../../../domain/portfolio/repositories/portfolio.repository.interface";

@Injectable()
export class ListPortfoliosUseCase {
  constructor(
    @Inject(PORTFOLIO_REPOSITORY)
    private readonly portfolioRepository: IPortfolioRepository,
  ) {}

  async execute(
    userId: string,
    pagination: PaginationParams,
  ): Promise<PaginatedResult<Portfolio>> {
    const offset = (pagination.page - 1) * pagination.limit;
    return this.portfolioRepository.findByUserIdPaginated(
      userId,
      offset,
      pagination.limit,
    );
  }
}
