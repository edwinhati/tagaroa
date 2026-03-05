import { Inject, Injectable } from "@nestjs/common";
import {
  PortfolioAccessDeniedException,
  PortfolioNotFoundException,
} from "../../../domain/exceptions/investment.exceptions";
import {
  type IInstrumentRepository,
  INSTRUMENT_REPOSITORY,
} from "../../../domain/market-data/repositories/instrument.repository.interface";
import {
  type IOhlcvRepository,
  OHLCV_REPOSITORY,
} from "../../../domain/market-data/repositories/ohlcv.repository.interface";
import {
  type IPortfolioRepository,
  PORTFOLIO_REPOSITORY,
} from "../../../domain/portfolio/repositories/portfolio.repository.interface";
import {
  type IPositionRepository,
  POSITION_REPOSITORY,
} from "../../../domain/portfolio/repositories/position.repository.interface";
import { AssetClass } from "../../../domain/value-objects/asset-class.value-object";

const STALENESS_DAYS: Partial<Record<AssetClass, number>> = {
  [AssetClass.STOCK]: 3,
  [AssetClass.ETF]: 3,
  [AssetClass.CRYPTO]: 2,
  [AssetClass.FOREX]: 5,
  [AssetClass.COMMODITY]: 3,
};

export interface PositionWithPnl {
  id: string;
  portfolioId: string;
  instrumentId: string;
  ticker: string;
  assetClass: string;
  quantity: number;
  averageCost: number;
  side: string;
  openedAt: Date;
  currentPrice: number;
  marketValue: number;
  costBasis: number;
  unrealizedPnl: number;
  unrealizedPnlPct: number;
  weight: number;
  isStale: boolean;
  priceDate: Date | null;
}

@Injectable()
export class GetPositionsWithPnlUseCase {
  @Inject(PORTFOLIO_REPOSITORY)
  private readonly portfolioRepository!: IPortfolioRepository;
  @Inject(POSITION_REPOSITORY)
  private readonly positionRepository!: IPositionRepository;
  @Inject(OHLCV_REPOSITORY)
  private readonly ohlcvRepository!: IOhlcvRepository;
  @Inject(INSTRUMENT_REPOSITORY)
  private readonly instrumentRepository!: IInstrumentRepository;

  async execute(
    portfolioId: string,
    userId: string,
  ): Promise<PositionWithPnl[]> {
    const portfolio = await this.portfolioRepository.findById(portfolioId);
    if (!portfolio) {
      throw new PortfolioNotFoundException(portfolioId);
    }
    if (portfolio.userId !== userId) {
      throw new PortfolioAccessDeniedException();
    }

    const positions =
      await this.positionRepository.findOpenByPortfolioId(portfolioId);

    if (positions.length === 0) return [];

    // Compute total market value for weight calculation
    const enriched: Omit<PositionWithPnl, "weight">[] = [];
    let totalMarketValue = 0;

    for (const position of positions) {
      const instrument = await this.instrumentRepository.findById(
        position.instrumentId,
      );
      const ticker = instrument?.ticker ?? position.instrumentId.slice(0, 8);
      const assetClass = instrument?.assetClass ?? "UNKNOWN";

      const latestOhlcv = await this.ohlcvRepository.findLatest(
        position.instrumentId,
        "1d",
      );
      const currentPrice = latestOhlcv
        ? Number(latestOhlcv.close)
        : Number(position.averageCost);
      const priceDate = latestOhlcv ? latestOhlcv.timestamp : null;

      const thresholdDays = STALENESS_DAYS[assetClass as AssetClass] ?? 3;
      const isStale =
        priceDate !== null
          ? (Date.now() - priceDate.getTime()) / (1000 * 60 * 60 * 24) >
            thresholdDays
          : false;

      const qty = Number(position.quantity);
      const avgCost = Number(position.averageCost);
      const costBasis =
        position.side === "LONG" ? qty * avgCost : -(qty * avgCost);
      const marketVal =
        position.side === "LONG" ? qty * currentPrice : -(qty * currentPrice);
      const unrealizedPnl = marketVal - costBasis;
      const unrealizedPnlPct =
        Math.abs(costBasis) > 0
          ? (unrealizedPnl / Math.abs(costBasis)) * 100
          : 0;

      totalMarketValue += Math.abs(marketVal);

      enriched.push({
        id: position.id,
        portfolioId: position.portfolioId,
        instrumentId: position.instrumentId,
        ticker,
        assetClass,
        quantity: qty,
        averageCost: avgCost,
        side: position.side,
        openedAt: position.openedAt,
        currentPrice,
        marketValue: marketVal,
        costBasis,
        unrealizedPnl,
        unrealizedPnlPct,
        isStale,
        priceDate,
      });
    }

    return enriched.map((p) => ({
      ...p,
      weight:
        totalMarketValue > 0
          ? (Math.abs(p.marketValue) / totalMarketValue) * 100
          : 0,
    }));
  }
}
