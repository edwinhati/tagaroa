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

interface AllocationByInstrument {
  instrumentId: string;
  ticker: string;
  assetClass: string;
  weight: number;
  value: number;
}

interface AllocationByAssetClass {
  assetClass: string;
  weight: number;
  value: number;
}

interface PortfolioAllocation {
  byInstrument: AllocationByInstrument[];
  byAssetClass: AllocationByAssetClass[];
  herfindahlIndex: number;
  totalValue: number;
}

@Injectable()
export class GetPortfolioAllocationUseCase {
  constructor(
    @Inject(PORTFOLIO_REPOSITORY)
    private readonly portfolioRepository: IPortfolioRepository,
    @Inject(POSITION_REPOSITORY)
    private readonly positionRepository: IPositionRepository,
    @Inject(OHLCV_REPOSITORY)
    private readonly ohlcvRepository: IOhlcvRepository,
    @Inject(INSTRUMENT_REPOSITORY)
    private readonly instrumentRepository: IInstrumentRepository,
  ) {}

  async execute(
    portfolioId: string,
    userId: string,
  ): Promise<PortfolioAllocation> {
    const portfolio = await this.portfolioRepository.findById(portfolioId);
    if (!portfolio) {
      throw new PortfolioNotFoundException(portfolioId);
    }
    if (portfolio.userId !== userId) {
      throw new PortfolioAccessDeniedException();
    }

    const positions =
      await this.positionRepository.findOpenByPortfolioId(portfolioId);

    if (positions.length === 0) {
      return {
        byInstrument: [],
        byAssetClass: [],
        herfindahlIndex: 0,
        totalValue: 0,
      };
    }

    const positionValues: {
      instrumentId: string;
      ticker: string;
      assetClass: string;
      value: number;
    }[] = [];

    let totalValue = 0;

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
      const price = latestOhlcv
        ? Number(latestOhlcv.close)
        : Number(position.averageCost);

      const value = Math.abs(Number(position.quantity) * price);
      totalValue += value;

      positionValues.push({
        instrumentId: position.instrumentId,
        ticker,
        assetClass,
        value,
      });
    }

    const byInstrument: AllocationByInstrument[] = positionValues.map((p) => ({
      instrumentId: p.instrumentId,
      ticker: p.ticker,
      assetClass: p.assetClass,
      weight: totalValue > 0 ? (p.value / totalValue) * 100 : 0,
      value: p.value,
    }));

    // Group by asset class
    const assetClassMap = new Map<string, number>();
    for (const p of positionValues) {
      assetClassMap.set(
        p.assetClass,
        (assetClassMap.get(p.assetClass) ?? 0) + p.value,
      );
    }

    const byAssetClass: AllocationByAssetClass[] = Array.from(
      assetClassMap.entries(),
    ).map(([assetClass, value]) => ({
      assetClass,
      weight: totalValue > 0 ? (value / totalValue) * 100 : 0,
      value,
    }));

    // Herfindahl-Hirschman Index (sum of squared weights)
    const herfindahlIndex = byInstrument.reduce(
      (sum, p) => sum + (p.weight / 100) ** 2,
      0,
    );

    return { byInstrument, byAssetClass, herfindahlIndex, totalValue };
  }
}
