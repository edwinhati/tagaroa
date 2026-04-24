import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from "@nestjs/common";
import { Session, type UserSession } from "@thallesp/nestjs-better-auth";
import { toNavResponse } from "../../application/dtos/performance/nav-response.dto";
import { toPerformanceMetricsResponse } from "../../application/dtos/performance/performance-metrics-response.dto";
import { ComputeNavUseCase } from "../../application/use-cases/performance/compute-nav.use-case";
import { GetPerformanceMetricsUseCase } from "../../application/use-cases/performance/get-performance-metrics.use-case";
import { GetRollingMetricsUseCase } from "../../application/use-cases/performance/get-rolling-metrics.use-case";
import { GetSnapshotHistoryUseCase } from "../../application/use-cases/performance/get-snapshot-history.use-case";
import { SnapshotPortfolioUseCase } from "../../application/use-cases/performance/snapshot-portfolio.use-case";

class CreateSnapshotDto {
  declare nav: number;

  declare cash: number;
}

@Controller("investment/portfolios/:portfolioId/performance")
export class PerformanceController {
  constructor(
    private readonly getPerformanceMetricsUseCase: GetPerformanceMetricsUseCase,
    private readonly snapshotPortfolioUseCase: SnapshotPortfolioUseCase,
    private readonly computeNavUseCase: ComputeNavUseCase,
    private readonly getSnapshotHistoryUseCase: GetSnapshotHistoryUseCase,
    private readonly getRollingMetricsUseCase: GetRollingMetricsUseCase,
  ) {}

  @Get()
  async getMetrics(
    @Param("portfolioId", ParseUUIDPipe) portfolioId: string,
    @Session() session: UserSession,
  ) {
    const metrics = await this.getPerformanceMetricsUseCase.execute(
      portfolioId,
      session.user.id,
    );
    return toPerformanceMetricsResponse(metrics);
  }

  @Get("nav")
  async computeNav(
    @Param("portfolioId", ParseUUIDPipe) portfolioId: string,
    @Session() session: UserSession,
  ) {
    const result = await this.computeNavUseCase.execute(
      portfolioId,
      session.user.id,
    );
    return toNavResponse(result);
  }

  @Get("snapshots")
  async getSnapshots(
    @Param("portfolioId", ParseUUIDPipe) portfolioId: string,
    @Session() session: UserSession,
    @Query("startDate") startDate?: string,
    @Query("endDate") endDate?: string,
  ) {
    const history = await this.getSnapshotHistoryUseCase.execute(
      portfolioId,
      session.user.id,
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
    );
    return history.map((item) => ({
      timestamp: item.timestamp,
      nav: item.nav,
      cash: item.cash,
      drawdown: item.drawdown,
    }));
  }

  @Get("rolling")
  async getRollingMetrics(
    @Param("portfolioId", ParseUUIDPipe) portfolioId: string,
    @Session() session: UserSession,
    @Query("window") window?: string,
  ) {
    const windowDays = window ? Number(window) : 30;
    const metrics = await this.getRollingMetricsUseCase.execute(
      portfolioId,
      session.user.id,
      windowDays,
    );
    return {
      window_days: metrics.windowDays,
      sharpe: metrics.sharpe,
      volatility: metrics.volatility,
      max_drawdown: metrics.maxDrawdown,
      total_return: metrics.totalReturn,
    };
  }

  @Post("snapshot")
  async snapshot(
    @Param("portfolioId", ParseUUIDPipe) portfolioId: string,
    @Session() session: UserSession,
    @Body() dto: CreateSnapshotDto,
  ) {
    return this.snapshotPortfolioUseCase.execute(
      portfolioId,
      dto.nav,
      dto.cash,
      session.user.id,
    );
  }

  @Post("auto-snapshot")
  async autoSnapshot(
    @Param("portfolioId", ParseUUIDPipe) portfolioId: string,
    @Session() session: UserSession,
  ) {
    const { nav, cash } = await this.computeNavUseCase.execute(
      portfolioId,
      session.user.id,
    );
    const snapshot = await this.snapshotPortfolioUseCase.execute(
      portfolioId,
      nav,
      cash,
      session.user.id,
    );
    return {
      snapshotId: snapshot.id,
      nav,
      cash,
      recordedAt: snapshot.timestamp,
    };
  }
}
