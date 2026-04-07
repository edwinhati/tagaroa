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

interface CorrelationMatrix {
  tickers: string[];
  matrix: number[][];
}

type InstrumentReturns = { ticker: string; returns: Map<string, number> };

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
      return this.buildTrivialResult(positions.map((p) => p.instrumentId));
    }

    const instrumentData = await this.fetchInstrumentData(positions);
    const commonDates = this.findCommonDates(instrumentData);
    const matrix = this.buildMatrix(instrumentData, commonDates);
    const tickers = instrumentData.map((d) => d.ticker);

    return { tickers, matrix };
  }

  private async buildTrivialResult(
    instrumentIds: string[],
  ): Promise<CorrelationMatrix> {
    const tickers = await Promise.all(
      instrumentIds.map(async (id) => {
        const inst = await this.instrumentRepository.findById(id);
        return inst?.ticker ?? id.slice(0, 8);
      }),
    );
    const matrix = tickers.length === 1 ? [[1]] : [];
    return { tickers, matrix };
  }

  private async fetchInstrumentData(
    positions: { instrumentId: string }[],
  ): Promise<InstrumentReturns[]> {
    const results: InstrumentReturns[] = [];
    for (const position of positions) {
      const item = await this.buildInstrumentReturns(position.instrumentId);
      results.push(item);
    }
    return results;
  }

  private async buildInstrumentReturns(
    instrumentId: string,
  ): Promise<InstrumentReturns> {
    const instrument = await this.instrumentRepository.findById(instrumentId);
    const ticker = instrument?.ticker ?? instrumentId.slice(0, 8);

    const startDate = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
    const ohlcvList = await this.ohlcvRepository.findMany({
      instrumentId,
      timeframe: Timeframe.ONE_DAY,
      startDate,
      limit: 400,
    });

    const returns = new Map<string, number>();
    for (let i = 1; i < ohlcvList.length; i++) {
      this.addDailyReturn(returns, ohlcvList[i - 1], ohlcvList[i]);
    }

    return { ticker, returns };
  }

  private addDailyReturn(
    returns: Map<string, number>,
    prev: { close: number; timestamp: Date } | undefined,
    curr: { close: number; timestamp: Date } | undefined,
  ): void {
    if (!prev || !curr || prev.close <= 0) return;
    const dateKey = curr.timestamp.toISOString().split("T")[0];
    if (dateKey) {
      returns.set(dateKey, (curr.close - prev.close) / prev.close);
    }
  }

  private findCommonDates(instrumentData: InstrumentReturns[]): string[] {
    const firstReturns = instrumentData[0]?.returns;
    if (!firstReturns) return [];
    return [...firstReturns.keys()].filter((date) =>
      instrumentData.every((d) => d.returns.has(date)),
    );
  }

  private buildMatrix(
    instrumentData: InstrumentReturns[],
    commonDates: string[],
  ): number[][] {
    const n = instrumentData.length;
    const matrix: number[][] = Array.from({ length: n }, () =>
      new Array(n).fill(0),
    );

    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        this.fillMatrixCell(matrix, instrumentData, commonDates, i, j);
      }
    }

    return matrix;
  }

  private fillMatrixCell(
    matrix: number[][],
    instrumentData: InstrumentReturns[],
    commonDates: string[],
    i: number,
    j: number,
  ): void {
    const row = matrix[i];
    if (!row) return;

    if (i === j) {
      row[j] = 1;
      return;
    }

    if (i > j) {
      row[j] = matrix[j]?.[i] ?? 0;
      return;
    }

    const a = commonDates.map((d) => instrumentData[i]?.returns.get(d) ?? 0);
    const b = commonDates.map((d) => instrumentData[j]?.returns.get(d) ?? 0);
    row[j] = Number(pearsonCorrelation(a, b).toFixed(4));
  }
}
