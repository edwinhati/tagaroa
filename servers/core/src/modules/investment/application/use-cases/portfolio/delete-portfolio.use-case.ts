import { Inject, Injectable } from "@nestjs/common";
import {
  PortfolioAccessDeniedException,
  PortfolioNotFoundException,
} from "../../../domain/exceptions/investment.exceptions";
import {
  type IPortfolioRepository,
  PORTFOLIO_REPOSITORY,
} from "../../../domain/portfolio/repositories/portfolio.repository.interface";

@Injectable()
export class DeletePortfolioUseCase {
  constructor(
    @Inject(PORTFOLIO_REPOSITORY)
    private readonly portfolioRepository: IPortfolioRepository,
  ) {}

  async execute(id: string, userId: string): Promise<void> {
    const portfolio = await this.portfolioRepository.findById(id);
    if (!portfolio) {
      throw new PortfolioNotFoundException(id);
    }
    if (portfolio.userId !== userId) {
      throw new PortfolioAccessDeniedException();
    }
    await this.portfolioRepository.delete(id);
  }
}
