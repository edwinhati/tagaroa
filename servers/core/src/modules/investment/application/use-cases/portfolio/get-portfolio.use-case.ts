import { Inject, Injectable } from "@nestjs/common";
import {
  PortfolioAccessDeniedException,
  PortfolioNotFoundException,
} from "../../../domain/exceptions/investment.exceptions";
import type { Portfolio } from "../../../domain/portfolio/entities/portfolio.entity";
import {
  type IPortfolioRepository,
  PORTFOLIO_REPOSITORY,
} from "../../../domain/portfolio/repositories/portfolio.repository.interface";

@Injectable()
export class GetPortfolioUseCase {
  constructor(
    @Inject(PORTFOLIO_REPOSITORY)
    private readonly portfolioRepository: IPortfolioRepository,
  ) {}

  async execute(id: string, userId: string): Promise<Portfolio> {
    const portfolio = await this.portfolioRepository.findById(id);
    if (!portfolio) {
      throw new PortfolioNotFoundException(id);
    }
    if (portfolio.userId !== userId) {
      throw new PortfolioAccessDeniedException();
    }
    return portfolio;
  }
}
