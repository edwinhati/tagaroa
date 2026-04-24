import { Controller, Get, Param, ParseUUIDPipe } from "@nestjs/common";
import { Session, type UserSession } from "@thallesp/nestjs-better-auth";
import { GetCorrelationMatrixUseCase } from "../../application/use-cases/analytics/get-correlation-matrix.use-case";
import { GetPortfolioAllocationUseCase } from "../../application/use-cases/portfolio/get-portfolio-allocation.use-case";
import { GetPositionsWithPnlUseCase } from "../../application/use-cases/portfolio/get-positions-with-pnl.use-case";

@Controller("investment/portfolios/:portfolioId")
export class AnalyticsController {
  constructor(
    private readonly getPositionsWithPnlUseCase: GetPositionsWithPnlUseCase,
    private readonly getPortfolioAllocationUseCase: GetPortfolioAllocationUseCase,
    private readonly getCorrelationMatrixUseCase: GetCorrelationMatrixUseCase,
  ) {}

  @Get("positions/pnl")
  async getPositionsWithPnl(
    @Param("portfolioId", ParseUUIDPipe) portfolioId: string,
    @Session() session: UserSession,
  ) {
    const positions = await this.getPositionsWithPnlUseCase.execute(
      portfolioId,
      session.user.id,
    );
    return positions.map((p) => ({
      id: p.id,
      portfolio_id: p.portfolioId,
      instrument_id: p.instrumentId,
      ticker: p.ticker,
      asset_class: p.assetClass,
      quantity: p.quantity,
      average_cost: p.averageCost,
      side: p.side,
      opened_at: p.openedAt,
      current_price: p.currentPrice,
      market_value: p.marketValue,
      cost_basis: p.costBasis,
      unrealized_pnl: p.unrealizedPnl,
      unrealized_pnl_pct: p.unrealizedPnlPct,
      weight: p.weight,
      is_stale: p.isStale,
      price_date: p.priceDate,
    }));
  }

  @Get("allocation")
  async getAllocation(
    @Param("portfolioId", ParseUUIDPipe) portfolioId: string,
    @Session() session: UserSession,
  ) {
    const allocation = await this.getPortfolioAllocationUseCase.execute(
      portfolioId,
      session.user.id,
    );
    return {
      by_instrument: allocation.byInstrument.map((item) => ({
        instrument_id: item.instrumentId,
        ticker: item.ticker,
        asset_class: item.assetClass,
        weight: item.weight,
        value: item.value,
      })),
      by_asset_class: allocation.byAssetClass.map((item) => ({
        asset_class: item.assetClass,
        weight: item.weight,
        value: item.value,
      })),
      herfindahl_index: allocation.herfindahlIndex,
      total_value: allocation.totalValue,
    };
  }

  @Get("analytics/correlation")
  async getCorrelationMatrix(
    @Param("portfolioId", ParseUUIDPipe) portfolioId: string,
    @Session() session: UserSession,
  ) {
    const result = await this.getCorrelationMatrixUseCase.execute(
      portfolioId,
      session.user.id,
    );
    return {
      tickers: result.tickers,
      matrix: result.matrix,
    };
  }
}
