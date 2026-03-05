import { Inject, Injectable } from "@nestjs/common";
import {
  PortfolioAccessDeniedException,
  PortfolioNotFoundException,
} from "../../../domain/exceptions/investment.exceptions";
import { PerformanceMetrics } from "../../../domain/performance/entities/performance-metrics.entity";
import {
  type IPortfolioSnapshotRepository,
  PORTFOLIO_SNAPSHOT_REPOSITORY,
} from "../../../domain/performance/repositories/snapshot.repository.interface";
import type { CashFlow } from "../../../domain/portfolio/entities/cash-flow.entity";
import {
  CASH_FLOW_REPOSITORY,
  type ICashFlowRepository,
} from "../../../domain/portfolio/repositories/cash-flow.repository.interface";
import {
  type IPortfolioRepository,
  PORTFOLIO_REPOSITORY,
} from "../../../domain/portfolio/repositories/portfolio.repository.interface";

const RISK_FREE_RATE_ANNUAL = 0.02;
const RISK_FREE_DAILY = RISK_FREE_RATE_ANNUAL / 252;

// ── Pure computation helpers ────────────────────────────────────────

function computeMaxDrawdown(navs: number[]): {
  maxDrawdown: number;
  maxDrawdownPct: number;
} {
  let peak = navs[0] ?? 0;
  let maxDrawdown = 0;
  for (const nav of navs) {
    if (nav > peak) peak = nav;
    const drawdown = peak - nav;
    if (drawdown > maxDrawdown) maxDrawdown = drawdown;
  }
  const maxDrawdownPct = peak > 0 ? (maxDrawdown / peak) * 100 : 0;
  return { maxDrawdown, maxDrawdownPct };
}

function computeDailyReturns(navs: number[]): number[] {
  const returns: number[] = [];
  for (let i = 1; i < navs.length; i++) {
    const prev = navs[i - 1];
    const curr = navs[i];
    if (prev && curr && prev > 0) {
      returns.push((curr - prev) / prev);
    }
  }
  return returns;
}

function computeVolatilityAndSharpe(returns: number[]): {
  volatility: number | null;
  sharpe: number | null;
  mean: number;
} {
  if (returns.length <= 1) {
    return { volatility: null, sharpe: null, mean: 0 };
  }
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance =
    returns.reduce((acc, r) => acc + (r - mean) ** 2, 0) / (returns.length - 1);
  const stdDev = Math.sqrt(variance);
  const volatility = stdDev * Math.sqrt(252) * 100;
  const sharpe =
    stdDev > 0 ? ((mean - RISK_FREE_DAILY) / stdDev) * Math.sqrt(252) : null;
  return { volatility, sharpe, mean };
}

function computeSortino(returns: number[], mean: number): number | null {
  if (returns.length <= 1) return null;
  const negativeReturns = returns.filter((r) => r < RISK_FREE_DAILY);
  if (negativeReturns.length === 0) return null;
  const downsideVariance =
    negativeReturns.reduce((acc, r) => acc + (r - RISK_FREE_DAILY) ** 2, 0) /
    negativeReturns.length;
  const downsideStd = Math.sqrt(downsideVariance);
  return downsideStd > 0
    ? ((mean - RISK_FREE_DAILY) / downsideStd) * Math.sqrt(252)
    : null;
}

function computeWinRate(returns: number[]): number | null {
  if (returns.length === 0) return null;
  return (returns.filter((r) => r > 0).length / returns.length) * 100;
}

function computeProfitFactor(returns: number[]): number | null {
  const gains = returns.filter((r) => r > 0).reduce((a, b) => a + b, 0);
  const losses = Math.abs(
    returns.filter((r) => r < 0).reduce((a, b) => a + b, 0),
  );
  return losses > 0 ? gains / losses : null;
}

function computeCagr(
  initialNav: number,
  currentNav: number,
  timestamps: Date[],
  snapshotCount: number,
): number | null {
  const first = timestamps[0];
  const last = timestamps.at(-1);
  if (snapshotCount <= 1 || !first || !last) return null;
  const totalDays = (last.getTime() - first.getTime()) / (1000 * 60 * 60 * 24);
  if (totalDays <= 0 || initialNav <= 0) return null;
  return ((currentNav / initialNav) ** (365 / totalDays) - 1) * 100;
}

function computeTwr(
  navs: number[],
  cashFlows: CashFlow[],
  snapshotTimestamps: Date[],
): number | null {
  if (navs.length < 2) return null;

  const sorted = [...cashFlows].sort(
    (a, b) => a.timestamp.getTime() - b.timestamp.getTime(),
  );

  let twr = 1;
  const firstNav = navs[0];
  if (firstNav === undefined) return null;
  let prevNav = firstNav;

  for (let i = 1; i < navs.length; i++) {
    const periodStart = snapshotTimestamps[i - 1];
    const periodEnd = snapshotTimestamps[i];
    const endNav = navs[i];

    if (
      periodStart === undefined ||
      periodEnd === undefined ||
      endNav === undefined
    ) {
      continue;
    }

    const periodFlows = sorted.filter(
      (cf) => cf.timestamp >= periodStart && cf.timestamp < periodEnd,
    );

    const netFlow = periodFlows.reduce((sum, cf) => {
      switch (cf.type) {
        case "DEPOSIT":
        case "DIVIDEND":
          return sum + cf.amount;
        case "WITHDRAWAL":
          return sum - cf.amount;
        default:
          return sum;
      }
    }, 0);

    const subReturn =
      prevNav + netFlow > 0 ? endNav / (prevNav + netFlow) - 1 : 0;
    twr *= 1 + subReturn;
    prevNav = endNav;
  }

  return twr - 1;
}

function computeVaR(returns: number[], confidence: number): number | null {
  if (returns.length < 10) return null;
  const sorted = [...returns].sort((a, b) => a - b);
  const idx = Math.floor((1 - confidence) * sorted.length);
  return sorted[idx] ?? null;
}

function computeCVaR(returns: number[], varValue: number): number | null {
  if (returns.length < 10) return null;
  const tail = returns.filter((r) => r <= varValue);
  if (tail.length === 0) return null;
  return tail.reduce((a, b) => a + b, 0) / tail.length;
}

function toPercentOrNull(value: number | null): number | null {
  return value === null ? null : value * 100;
}

// ── Use case ────────────────────────────────────────────────────────

@Injectable()
export class GetPerformanceMetricsUseCase {
  constructor(
    @Inject(PORTFOLIO_REPOSITORY)
    private readonly portfolioRepository: IPortfolioRepository,
    @Inject(PORTFOLIO_SNAPSHOT_REPOSITORY)
    private readonly snapshotRepository: IPortfolioSnapshotRepository,
    @Inject(CASH_FLOW_REPOSITORY)
    private readonly cashFlowRepository: ICashFlowRepository,
  ) {}

  async execute(
    portfolioId: string,
    userId: string,
  ): Promise<PerformanceMetrics> {
    const portfolio = await this.portfolioRepository.findById(portfolioId);
    if (!portfolio) throw new PortfolioNotFoundException(portfolioId);
    if (portfolio.userId !== userId) throw new PortfolioAccessDeniedException();

    const snapshots =
      await this.snapshotRepository.findByPortfolioId(portfolioId);

    if (snapshots.length === 0) {
      return this.buildEmptyMetrics(portfolioId);
    }

    const navs = snapshots.map((s) => s.nav);
    const timestamps = snapshots.map((s) => s.timestamp);
    const initialNav = portfolio.initialCapital;
    const currentNav = navs.at(-1) ?? initialNav;

    const totalReturn = currentNav - initialNav;
    const totalReturnPct =
      initialNav > 0 ? (totalReturn / initialNav) * 100 : 0;

    const { maxDrawdown, maxDrawdownPct } = computeMaxDrawdown(navs);
    const returns = computeDailyReturns(navs);
    const { volatility, sharpe, mean } = computeVolatilityAndSharpe(returns);
    const sortinoRatio = computeSortino(returns, mean);
    const winRate = computeWinRate(returns);
    const profitFactor = computeProfitFactor(returns);
    const cagr = computeCagr(
      initialNav,
      currentNav,
      timestamps,
      snapshots.length,
    );
    const calmarRatio =
      cagr !== null && maxDrawdownPct > 0 ? cagr / maxDrawdownPct : null;
    const twr = await this.computeTwrForPortfolio(
      portfolioId,
      navs,
      timestamps,
      snapshots.length,
    );

    const var95 = computeVaR(returns, 0.95);
    const var99 = computeVaR(returns, 0.99);
    const cvar95 = var95 === null ? null : computeCVaR(returns, var95);
    const cvar99 = var99 === null ? null : computeCVaR(returns, var99);

    return new PerformanceMetrics(
      portfolioId,
      totalReturn,
      totalReturnPct,
      sharpe,
      maxDrawdown,
      maxDrawdownPct,
      volatility,
      winRate,
      snapshots.length,
      snapshots[0]?.timestamp ?? null,
      snapshots.at(-1)?.timestamp ?? null,
      twr,
      cagr,
      sortinoRatio,
      calmarRatio,
      profitFactor,
      toPercentOrNull(var95),
      toPercentOrNull(var99),
      toPercentOrNull(cvar95),
      toPercentOrNull(cvar99),
    );
  }

  private buildEmptyMetrics(portfolioId: string): PerformanceMetrics {
    return new PerformanceMetrics(
      portfolioId,
      0,
      0,
      null,
      0,
      0,
      null,
      null,
      0,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
    );
  }

  private async computeTwrForPortfolio(
    portfolioId: string,
    navs: number[],
    timestamps: Date[],
    snapshotCount: number,
  ): Promise<number | null> {
    if (snapshotCount < 2) return null;
    const first = timestamps[0];
    const last = timestamps.at(-1);
    if (!first || !last) return null;

    const cashFlows = await this.cashFlowRepository.findByPortfolioIdInRange(
      portfolioId,
      first,
      last,
    );
    const twr = computeTwr(navs, cashFlows, timestamps);
    return twr === null ? null : twr * 100;
  }
}
