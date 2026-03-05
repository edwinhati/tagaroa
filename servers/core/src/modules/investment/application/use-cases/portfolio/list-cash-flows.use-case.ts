import { Inject, Injectable } from "@nestjs/common";
import {
  PortfolioAccessDeniedException,
  PortfolioNotFoundException,
} from "../../../domain/exceptions/investment.exceptions";
import type { CashFlow } from "../../../domain/portfolio/entities/cash-flow.entity";
import {
  CASH_FLOW_REPOSITORY,
  type ICashFlowRepository,
} from "../../../domain/portfolio/repositories/cash-flow.repository.interface";
import {
  type IPortfolioRepository,
  PORTFOLIO_REPOSITORY,
} from "../../../domain/portfolio/repositories/portfolio.repository.interface";

@Injectable()
export class ListCashFlowsUseCase {
  constructor(
    @Inject(PORTFOLIO_REPOSITORY)
    private readonly portfolioRepository: IPortfolioRepository,
    @Inject(CASH_FLOW_REPOSITORY)
    private readonly cashFlowRepository: ICashFlowRepository,
  ) {}

  async execute(
    portfolioId: string,
    userId: string,
    offset = 0,
    limit = 50,
  ): Promise<CashFlow[]> {
    const portfolio = await this.portfolioRepository.findById(portfolioId);
    if (!portfolio) {
      throw new PortfolioNotFoundException(portfolioId);
    }
    if (portfolio.userId !== userId) {
      throw new PortfolioAccessDeniedException();
    }

    return this.cashFlowRepository.findByPortfolioId(
      portfolioId,
      offset,
      limit,
    );
  }
}
