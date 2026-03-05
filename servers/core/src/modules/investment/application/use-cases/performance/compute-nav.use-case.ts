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

function isPriceStale(priceDate: Date, assetClass: AssetClass): boolean {
  const thresholdDays = STALENESS_DAYS[assetClass] ?? 3;
  const ageMs = Date.now() - priceDate.getTime();
  const ageDays = ageMs / (1000 * 60 * 60 * 24);
  return ageDays > thresholdDays;
}

export interface NavBreakdownItem {
  ticker: string;
  side: string;
  quantity: number;
  price: number;
  priceDate: Date | null;
  isStale: boolean;
  value: number;
  isFallback: boolean;
}

export interface NavResult {
  nav: number;
  cash: number;
  pricesFrom: "ohlcv" | "fallback";
  breakdown: NavBreakdownItem[];
}

@Injectable()
export class ComputeNavUseCase {
  @Inject(PORTFOLIO_REPOSITORY)
  private readonly portfolioRepository!: IPortfolioRepository;
  @Inject(POSITION_REPOSITORY)
  private readonly positionRepository!: IPositionRepository;
  @Inject(OHLCV_REPOSITORY)
  private readonly ohlcvRepository!: IOhlcvRepository;
  @Inject(INSTRUMENT_REPOSITORY)
  private readonly instrumentRepository!: IInstrumentRepository;

  async execute(portfolioId: string, userId: string): Promise<NavResult> {
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
        nav: portfolio.initialCapital,
        cash: portfolio.initialCapital,
        pricesFrom: "fallback",
        breakdown: [],
      };
    }

    let allFallback = true;
    const breakdown: NavBreakdownItem[] = [];

    let deployedCapital = 0;
    let marketValue = 0;

    for (const position of positions) {
      const instrument = await this.instrumentRepository.findById(
        position.instrumentId,
      );
      const ticker = instrument?.ticker ?? position.instrumentId.slice(0, 8);

      const latestOhlcv = await this.ohlcvRepository.findLatest(
        position.instrumentId,
        "1d",
      );
      const isFallback = latestOhlcv === null;
      const price = latestOhlcv
        ? Number(latestOhlcv.close)
        : Number(position.averageCost);
      const priceDate = latestOhlcv ? latestOhlcv.timestamp : null;
      const isStale =
        priceDate !== null && instrument
          ? isPriceStale(priceDate, instrument.assetClass)
          : false;

      if (!isFallback) {
        allFallback = false;
      }

      const costContribution =
        position.side === "LONG"
          ? Number(position.quantity) * Number(position.averageCost)
          : -(Number(position.quantity) * Number(position.averageCost));
      deployedCapital += costContribution;

      const positionValue =
        position.side === "LONG"
          ? Number(position.quantity) * price
          : -(Number(position.quantity) * price);
      marketValue += positionValue;

      breakdown.push({
        ticker,
        side: position.side,
        quantity: Number(position.quantity),
        price,
        priceDate,
        isStale,
        value: positionValue,
        isFallback,
      });
    }

    const cash = Math.max(
      0,
      Number(portfolio.initialCapital) - deployedCapital,
    );
    const nav = cash + marketValue;

    return {
      nav,
      cash,
      pricesFrom: allFallback ? "fallback" : "ohlcv",
      breakdown,
    };
  }
}
