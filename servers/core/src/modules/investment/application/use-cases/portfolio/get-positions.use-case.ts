import { Inject, Injectable } from "@nestjs/common";
import {
  PortfolioAccessDeniedException,
  PortfolioNotFoundException,
} from "../../../domain/exceptions/investment.exceptions";
import type { Position } from "../../../domain/portfolio/entities/position.entity";
import {
  type IPortfolioRepository,
  PORTFOLIO_REPOSITORY,
} from "../../../domain/portfolio/repositories/portfolio.repository.interface";
import {
  type IPositionRepository,
  POSITION_REPOSITORY,
} from "../../../domain/portfolio/repositories/position.repository.interface";

@Injectable()
export class GetPositionsUseCase {
  @Inject(PORTFOLIO_REPOSITORY)
  private readonly portfolioRepository!: IPortfolioRepository;
  @Inject(POSITION_REPOSITORY)
  private readonly positionRepository!: IPositionRepository;

  async execute(
    portfolioId: string,
    userId: string,
    openOnly = true,
  ): Promise<Position[]> {
    const portfolio = await this.portfolioRepository.findById(portfolioId);
    if (!portfolio) {
      throw new PortfolioNotFoundException(portfolioId);
    }
    if (portfolio.userId !== userId) {
      throw new PortfolioAccessDeniedException();
    }

    if (openOnly) {
      return this.positionRepository.findOpenByPortfolioId(portfolioId);
    }
    return this.positionRepository.findByPortfolioId(portfolioId);
  }
}
