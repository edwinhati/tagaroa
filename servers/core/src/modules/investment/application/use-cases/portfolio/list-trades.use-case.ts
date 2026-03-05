import { Inject, Injectable } from "@nestjs/common";
import {
  PortfolioAccessDeniedException,
  PortfolioNotFoundException,
} from "../../../domain/exceptions/investment.exceptions";
import type { Trade } from "../../../domain/portfolio/entities/trade.entity";
import {
  type IPortfolioRepository,
  PORTFOLIO_REPOSITORY,
} from "../../../domain/portfolio/repositories/portfolio.repository.interface";
import {
  type ITradeRepository,
  TRADE_REPOSITORY,
} from "../../../domain/portfolio/repositories/trade.repository.interface";

@Injectable()
export class ListTradesUseCase {
  @Inject(PORTFOLIO_REPOSITORY)
  private readonly portfolioRepository!: IPortfolioRepository;
  @Inject(TRADE_REPOSITORY)
  private readonly tradeRepository!: ITradeRepository;

  async execute(
    portfolioId: string,
    userId: string,
    offset = 0,
    limit = 50,
  ): Promise<Trade[]> {
    const portfolio = await this.portfolioRepository.findById(portfolioId);
    if (!portfolio) {
      throw new PortfolioNotFoundException(portfolioId);
    }
    if (portfolio.userId !== userId) {
      throw new PortfolioAccessDeniedException();
    }

    return this.tradeRepository.findByPortfolioId(portfolioId, offset, limit);
  }
}
