import { Inject, Injectable } from "@nestjs/common";
import {
  PortfolioAccessDeniedException,
  PortfolioNotFoundException,
} from "../../../domain/exceptions/investment.exceptions";
import {
  type IPortfolioSnapshotRepository,
  PORTFOLIO_SNAPSHOT_REPOSITORY,
} from "../../../domain/performance/repositories/snapshot.repository.interface";
import {
  type IPortfolioRepository,
  PORTFOLIO_REPOSITORY,
} from "../../../domain/portfolio/repositories/portfolio.repository.interface";

export interface SnapshotHistoryItem {
  timestamp: Date;
  nav: number;
  cash: number;
  drawdown: number;
}

@Injectable()
export class GetSnapshotHistoryUseCase {
  @Inject(PORTFOLIO_REPOSITORY)
  private readonly portfolioRepository!: IPortfolioRepository;
  @Inject(PORTFOLIO_SNAPSHOT_REPOSITORY)
  private readonly snapshotRepository!: IPortfolioSnapshotRepository;

  async execute(
    portfolioId: string,
    userId: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<SnapshotHistoryItem[]> {
    const portfolio = await this.portfolioRepository.findById(portfolioId);
    if (!portfolio) {
      throw new PortfolioNotFoundException(portfolioId);
    }
    if (portfolio.userId !== userId) {
      throw new PortfolioAccessDeniedException();
    }

    const snapshots =
      startDate && endDate
        ? await this.snapshotRepository.findByPortfolioIdInRange(
            portfolioId,
            startDate,
            endDate,
          )
        : await this.snapshotRepository.findByPortfolioId(portfolioId);

    if (snapshots.length === 0) return [];

    // Compute running drawdown from peak
    let peakNav = snapshots[0]?.nav ?? 0;
    return snapshots.map((s) => {
      if (s.nav > peakNav) peakNav = s.nav;
      const drawdown = peakNav > 0 ? ((peakNav - s.nav) / peakNav) * 100 : 0;
      return {
        timestamp: s.timestamp,
        nav: s.nav,
        cash: s.cash,
        drawdown,
      };
    });
  }
}
