import { Inject, Injectable } from "@nestjs/common";
import {
  PortfolioAccessDeniedException,
  PortfolioNotFoundException,
} from "../../../domain/exceptions/investment.exceptions";
import { PortfolioSnapshot } from "../../../domain/performance/entities/portfolio-snapshot.entity";
import {
  type IPortfolioSnapshotRepository,
  PORTFOLIO_SNAPSHOT_REPOSITORY,
} from "../../../domain/performance/repositories/snapshot.repository.interface";
import {
  type IPortfolioRepository,
  PORTFOLIO_REPOSITORY,
} from "../../../domain/portfolio/repositories/portfolio.repository.interface";
import {
  type IPositionRepository,
  POSITION_REPOSITORY,
} from "../../../domain/portfolio/repositories/position.repository.interface";

@Injectable()
export class SnapshotPortfolioUseCase {
  @Inject(PORTFOLIO_REPOSITORY)
  private readonly portfolioRepository!: IPortfolioRepository;
  @Inject(POSITION_REPOSITORY)
  private readonly positionRepository!: IPositionRepository;
  @Inject(PORTFOLIO_SNAPSHOT_REPOSITORY)
  private readonly snapshotRepository!: IPortfolioSnapshotRepository;

  async execute(
    portfolioId: string,
    nav: number,
    cash: number,
    userId: string,
  ): Promise<PortfolioSnapshot> {
    const portfolio = await this.portfolioRepository.findById(portfolioId);
    if (!portfolio) {
      throw new PortfolioNotFoundException(portfolioId);
    }
    if (portfolio.userId !== userId) {
      throw new PortfolioAccessDeniedException();
    }

    const positions =
      await this.positionRepository.findOpenByPortfolioId(portfolioId);
    const positionsSnapshot = positions.reduce<Record<string, unknown>>(
      (acc, p) => {
        acc[p.id] = {
          instrumentId: p.instrumentId,
          quantity: p.quantity,
          averageCost: p.averageCost,
          side: p.side,
        };
        return acc;
      },
      {},
    );

    const now = new Date();
    const snapshot = new PortfolioSnapshot(
      crypto.randomUUID(),
      portfolioId,
      now,
      nav,
      cash,
      positionsSnapshot,
      now,
    );

    return this.snapshotRepository.create(snapshot);
  }
}
