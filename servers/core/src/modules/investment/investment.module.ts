import { Module } from "@nestjs/common";
import { ScheduleModule } from "@nestjs/schedule";
import { GetCorrelationMatrixUseCase } from "./application/use-cases/analytics/get-correlation-matrix.use-case";
import { GetOhlcvUseCase } from "./application/use-cases/market-data/get-ohlcv.use-case";
import { ListInstrumentsUseCase } from "./application/use-cases/market-data/list-instruments.use-case";
import { RegisterInstrumentUseCase } from "./application/use-cases/market-data/register-instrument.use-case";
import { SyncOhlcvUseCase } from "./application/use-cases/market-data/sync-ohlcv.use-case";
import { ComputeNavUseCase } from "./application/use-cases/performance/compute-nav.use-case";
import { GetPerformanceMetricsUseCase } from "./application/use-cases/performance/get-performance-metrics.use-case";
import { GetRollingMetricsUseCase } from "./application/use-cases/performance/get-rolling-metrics.use-case";
import { GetSnapshotHistoryUseCase } from "./application/use-cases/performance/get-snapshot-history.use-case";
import { SnapshotPortfolioUseCase } from "./application/use-cases/performance/snapshot-portfolio.use-case";
import { AddPositionUseCase } from "./application/use-cases/portfolio/add-position.use-case";
import { ClosePositionUseCase } from "./application/use-cases/portfolio/close-position.use-case";
import { CreatePortfolioUseCase } from "./application/use-cases/portfolio/create-portfolio.use-case";
import { DeleteCashFlowUseCase } from "./application/use-cases/portfolio/delete-cash-flow.use-case";
import { DeletePortfolioUseCase } from "./application/use-cases/portfolio/delete-portfolio.use-case";
import { GetPortfolioUseCase } from "./application/use-cases/portfolio/get-portfolio.use-case";
import { GetPortfolioAllocationUseCase } from "./application/use-cases/portfolio/get-portfolio-allocation.use-case";
import { GetPositionsUseCase } from "./application/use-cases/portfolio/get-positions.use-case";
import { GetPositionsWithPnlUseCase } from "./application/use-cases/portfolio/get-positions-with-pnl.use-case";
import { ListCashFlowsUseCase } from "./application/use-cases/portfolio/list-cash-flows.use-case";
import { ListPortfoliosUseCase } from "./application/use-cases/portfolio/list-portfolios.use-case";
import { ListTradesUseCase } from "./application/use-cases/portfolio/list-trades.use-case";
import { RecordCashFlowUseCase } from "./application/use-cases/portfolio/record-cash-flow.use-case";
import { UpdatePortfolioUseCase } from "./application/use-cases/portfolio/update-portfolio.use-case";
import { MARKET_DATA_PROVIDER } from "./domain/market-data/interfaces/market-data-provider.interface";
import { INSTRUMENT_REPOSITORY } from "./domain/market-data/repositories/instrument.repository.interface";
import { OHLCV_REPOSITORY } from "./domain/market-data/repositories/ohlcv.repository.interface";
import { PORTFOLIO_SNAPSHOT_REPOSITORY } from "./domain/performance/repositories/snapshot.repository.interface";
import { CASH_FLOW_REPOSITORY } from "./domain/portfolio/repositories/cash-flow.repository.interface";
import { PORTFOLIO_REPOSITORY } from "./domain/portfolio/repositories/portfolio.repository.interface";
import { POSITION_REPOSITORY } from "./domain/portfolio/repositories/position.repository.interface";
import { TRADE_REPOSITORY } from "./domain/portfolio/repositories/trade.repository.interface";
import { CoinGeckoProvider } from "./infrastructure/market-data-providers/coingecko.provider";
import { EcbRatesProvider } from "./infrastructure/market-data-providers/ecb-rates.provider";
import { YahooFinanceProvider } from "./infrastructure/market-data-providers/yahoo-finance.provider";
import { DrizzleCashFlowRepository } from "./infrastructure/persistence/drizzle/repositories/drizzle-cash-flow.repository";
import { DrizzleInstrumentRepository } from "./infrastructure/persistence/drizzle/repositories/drizzle-instrument.repository";
import { DrizzleOhlcvRepository } from "./infrastructure/persistence/drizzle/repositories/drizzle-ohlcv.repository";
import { DrizzlePortfolioRepository } from "./infrastructure/persistence/drizzle/repositories/drizzle-portfolio.repository";
import { DrizzlePositionRepository } from "./infrastructure/persistence/drizzle/repositories/drizzle-position.repository";
import { DrizzleSnapshotRepository } from "./infrastructure/persistence/drizzle/repositories/drizzle-snapshot.repository";
import { DrizzleTradeRepository } from "./infrastructure/persistence/drizzle/repositories/drizzle-trade.repository";
import { PortfolioSnapshotScheduler } from "./infrastructure/scheduler/portfolio-snapshot.scheduler";
import { AnalyticsController } from "./presentation/http/controllers/analytics.controller";
import { CashFlowController } from "./presentation/http/controllers/cash-flow.controller";
import { InstrumentController } from "./presentation/http/controllers/instrument.controller";
import { OhlcvController } from "./presentation/http/controllers/ohlcv.controller";
import { PerformanceController } from "./presentation/http/controllers/performance.controller";
import { PortfolioController } from "./presentation/http/controllers/portfolio.controller";
import { PositionController } from "./presentation/http/controllers/position.controller";
import { TradeController } from "./presentation/http/controllers/trade.controller";

@Module({
  imports: [ScheduleModule.forRoot()],
  controllers: [
    InstrumentController,
    OhlcvController,
    PortfolioController,
    PositionController,
    PerformanceController,
    CashFlowController,
    TradeController,
    AnalyticsController,
  ],
  providers: [
    // Repository bindings
    {
      provide: INSTRUMENT_REPOSITORY,
      useClass: DrizzleInstrumentRepository,
    },
    {
      provide: OHLCV_REPOSITORY,
      useClass: DrizzleOhlcvRepository,
    },
    {
      provide: PORTFOLIO_REPOSITORY,
      useClass: DrizzlePortfolioRepository,
    },
    {
      provide: POSITION_REPOSITORY,
      useClass: DrizzlePositionRepository,
    },
    {
      provide: PORTFOLIO_SNAPSHOT_REPOSITORY,
      useClass: DrizzleSnapshotRepository,
    },
    {
      provide: TRADE_REPOSITORY,
      useClass: DrizzleTradeRepository,
    },
    {
      provide: CASH_FLOW_REPOSITORY,
      useClass: DrizzleCashFlowRepository,
    },
    // Market data providers (multi-provider array)
    CoinGeckoProvider,
    YahooFinanceProvider,
    EcbRatesProvider,
    {
      provide: MARKET_DATA_PROVIDER,
      useFactory: (
        coingecko: CoinGeckoProvider,
        yahoo: YahooFinanceProvider,
        ecb: EcbRatesProvider,
      ) => [coingecko, yahoo, ecb],
      inject: [CoinGeckoProvider, YahooFinanceProvider, EcbRatesProvider],
    },
    // Use cases
    RegisterInstrumentUseCase,
    ListInstrumentsUseCase,
    GetOhlcvUseCase,
    SyncOhlcvUseCase,
    CreatePortfolioUseCase,
    ListPortfoliosUseCase,
    GetPortfolioUseCase,
    UpdatePortfolioUseCase,
    DeletePortfolioUseCase,
    AddPositionUseCase,
    ClosePositionUseCase,
    GetPositionsUseCase,
    RecordCashFlowUseCase,
    ListCashFlowsUseCase,
    DeleteCashFlowUseCase,
    ListTradesUseCase,
    GetPerformanceMetricsUseCase,
    GetSnapshotHistoryUseCase,
    SnapshotPortfolioUseCase,
    ComputeNavUseCase,
    GetPositionsWithPnlUseCase,
    GetPortfolioAllocationUseCase,
    GetRollingMetricsUseCase,
    GetCorrelationMatrixUseCase,
    // Scheduler
    PortfolioSnapshotScheduler,
  ],
})
export class InvestmentModule {}
