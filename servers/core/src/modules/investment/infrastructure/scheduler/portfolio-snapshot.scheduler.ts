import { Inject, Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { ComputeNavUseCase } from "../../application/use-cases/performance/compute-nav.use-case";
import { SnapshotPortfolioUseCase } from "../../application/use-cases/performance/snapshot-portfolio.use-case";
import { Ohlcv } from "../../domain/market-data/entities/ohlcv.entity";
import {
  type IMarketDataProvider,
  MARKET_DATA_PROVIDER,
} from "../../domain/market-data/interfaces/market-data-provider.interface";
import {
  type IInstrumentRepository,
  INSTRUMENT_REPOSITORY,
} from "../../domain/market-data/repositories/instrument.repository.interface";
import {
  type IOhlcvRepository,
  OHLCV_REPOSITORY,
} from "../../domain/market-data/repositories/ohlcv.repository.interface";
import {
  type IPortfolioRepository,
  PORTFOLIO_REPOSITORY,
} from "../../domain/portfolio/repositories/portfolio.repository.interface";
import {
  type IPositionRepository,
  POSITION_REPOSITORY,
} from "../../domain/portfolio/repositories/position.repository.interface";

@Injectable()
export class PortfolioSnapshotScheduler {
  private readonly logger = new Logger(PortfolioSnapshotScheduler.name);

  constructor(
    @Inject(PORTFOLIO_REPOSITORY)
    private readonly portfolioRepository: IPortfolioRepository,
    @Inject(POSITION_REPOSITORY)
    private readonly positionRepository: IPositionRepository,
    @Inject(INSTRUMENT_REPOSITORY)
    private readonly instrumentRepository: IInstrumentRepository,
    @Inject(OHLCV_REPOSITORY)
    private readonly ohlcvRepository: IOhlcvRepository,
    @Inject(MARKET_DATA_PROVIDER)
    private readonly providers: IMarketDataProvider[],
    private readonly computeNavUseCase: ComputeNavUseCase,
    private readonly snapshotPortfolioUseCase: SnapshotPortfolioUseCase,
  ) {}

  @Cron("0 22 * * *")
  async handleDailySnapshot(): Promise<void> {
    this.logger.log("Daily auto-snapshot job started");

    const portfolios = await this.portfolioRepository.findAllActive();
    this.logger.log(`Found ${portfolios.length} active portfolio(s)`);

    for (const portfolio of portfolios) {
      try {
        await this.syncPositionPrices(portfolio.id);

        const { nav, cash } = await this.computeNavUseCase.execute(
          portfolio.id,
          portfolio.userId,
        );

        await this.snapshotPortfolioUseCase.execute(
          portfolio.id,
          nav,
          cash,
          portfolio.userId,
        );

        this.logger.log(
          `Auto-snapshot recorded for portfolio ${portfolio.id} — NAV: ${nav.toFixed(2)}`,
        );
      } catch (err) {
        this.logger.error(
          `Auto-snapshot failed for portfolio ${portfolio.id}`,
          err instanceof Error ? err.stack : String(err),
        );
      }
    }

    this.logger.log("Daily auto-snapshot job completed");
  }

  private async syncPositionPrices(portfolioId: string): Promise<void> {
    const positions =
      await this.positionRepository.findOpenByPortfolioId(portfolioId);
    const endDate = new Date();
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - 2);

    for (const position of positions) {
      try {
        const instrument = await this.instrumentRepository.findById(
          position.instrumentId,
        );
        if (!instrument) continue;

        const provider = this.providers.find((p) =>
          p.supports(instrument.assetClass),
        );
        if (!provider) continue;

        const rawCandles = await provider.fetchOhlcv({
          ticker: instrument.ticker,
          assetClass: instrument.assetClass,
          timeframe: "1d",
          startDate,
          endDate,
        });

        const candles = rawCandles.map(
          (c) =>
            new Ohlcv(
              instrument.id,
              c.timestamp,
              c.timeframe,
              c.open,
              c.high,
              c.low,
              c.close,
              c.volume,
            ),
        );

        if (candles.length > 0) {
          await this.ohlcvRepository.upsertMany(candles);
        }
      } catch (err) {
        this.logger.warn(
          `OHLCV sync failed for position ${position.id}`,
          err instanceof Error ? err.message : String(err),
        );
      }
    }
  }
}
