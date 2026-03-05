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
import { Timeframe } from "../../../domain/value-objects/timeframe.value-object";

export interface CorrelationMatrix {
  tickers: string[];
  matrix: number[][];
}

function pearsonCorrelation(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  if (n < 2) return 0;

  let sumA = 0;
  let sumB = 0;
  for (let i = 0; i < n; i++) {
    sumA += a[i] ?? 0;
    sumB += b[i] ?? 0;
  }
  const meanA = sumA / n;
  const meanB = sumB / n;

  let cov = 0;
  let varA = 0;
  let varB = 0;
  for (let i = 0; i < n; i++) {
    const da = (a[i] ?? 0) - meanA;
    const db = (b[i] ?? 0) - meanB;
    cov += da * db;
    varA += da * da;
    varB += db * db;
  }

  const denom = Math.sqrt(varA * varB);
  return denom > 0 ? cov / denom : 0;
}

@Injectable()
export class GetCorrelationMatrixUseCase {
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
  ): Promise<CorrelationMatrix> {
    const portfolio = await this.portfolioRepository.findById(portfolioId);
    if (!portfolio) throw new PortfolioNotFoundException(portfolioId);
    if (portfolio.userId !== userId) throw new PortfolioAccessDeniedException();

    const positions =
      await this.positionRepository.findOpenByPortfolioId(portfolioId);

    if (positions.length < 2) {
      const tickers = await Promise.all(
        positions.map(async (p) => {
          const inst = await this.instrumentRepository.findById(p.instrumentId);
          return inst?.ticker ?? p.instrumentId.slice(0, 8);
        }),
      );
      return { tickers, matrix: positions.length === 1 ? [[1]] : [] };
    }

    // Fetch daily OHLCV for each instrument
    const instrumentData: { ticker: string; returns: Map<string, number> }[] =
      [];

    for (const position of positions) {
      const instrument = await this.instrumentRepository.findById(
        position.instrumentId,
      );
      const ticker = instrument?.ticker ?? position.instrumentId.slice(0, 8);

      const startDate = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
      const ohlcvList = await this.ohlcvRepository.findMany({
        instrumentId: position.instrumentId,
        timeframe: Timeframe.ONE_DAY,
        startDate,
        limit: 400,
      });

      const returns = new Map<string, number>();
      for (let i = 1; i < ohlcvList.length; i++) {
        const prev = ohlcvList[i - 1];
        const curr = ohlcvList[i];
        if (prev && curr && prev.close > 0) {
          const dateKey = curr.timestamp.toISOString().split("T")[0];
          if (dateKey) {
            returns.set(dateKey, (curr.close - prev.close) / prev.close);
          }
        }
      }

      instrumentData.push({ ticker, returns });
    }

    // Align dates across all instruments
    const firstReturns = instrumentData[0]?.returns;
    const commonDates = firstReturns
      ? [...firstReturns.keys()].filter((date) =>
          instrumentData.every((d) => d.returns.has(date)),
        )
      : [];

    const tickers = instrumentData.map((d) => d.ticker);
    const n = tickers.length;
    const matrix: number[][] = Array.from({ length: n }, () =>
      new Array(n).fill(0),
    );

    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (i === j) {
          const row = matrix[i];
          if (row) row[j] = 1;
          continue;
        }
        if (i > j) {
          const rowI = matrix[i];
          const rowJ = matrix[j];
          if (rowI && rowJ) {
            rowI[j] = rowJ[i] ?? 0;
          }
          continue;
        }
        const a = commonDates.map(
          (d) => instrumentData[i]?.returns.get(d) ?? 0,
        );
        const b = commonDates.map(
          (d) => instrumentData[j]?.returns.get(d) ?? 0,
        );
        const row = matrix[i];
        if (row) {
          row[j] = Number(pearsonCorrelation(a, b).toFixed(4));
        }
      }
    }

    return { tickers, matrix };
  }
}
