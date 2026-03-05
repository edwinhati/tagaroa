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

function computeTwr(
  navs: number[],
  cashFlows: CashFlow[],
  snapshotTimestamps: Date[],
): number | null {
  if (navs.length < 2) return null;

  // Sort cash flows by timestamp
  const sorted = [...cashFlows].sort(
    (a, b) => a.timestamp.getTime() - b.timestamp.getTime(),
  );

  // Build sub-periods: each snapshot is a period boundary
  // At each cash flow event, insert a sub-period break
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

    // Cash flows within this sub-period
    const periodFlows = sorted.filter(
      (cf) => cf.timestamp >= periodStart && cf.timestamp < periodEnd,
    );

    // Net external cash flow at start of period (deposits add to basis)
    const netFlow = periodFlows.reduce(
      (sum, cf) =>
        cf.type === "DEPOSIT" || cf.type === "DIVIDEND"
          ? sum + cf.amount
          : cf.type === "WITHDRAWAL"
            ? sum - cf.amount
            : sum,
      0,
    );

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

@Injectable()
export class GetPerformanceMetricsUseCase {
  @Inject(PORTFOLIO_REPOSITORY)
  private readonly portfolioRepository!: IPortfolioRepository;
  @Inject(PORTFOLIO_SNAPSHOT_REPOSITORY)
  private readonly snapshotRepository!: IPortfolioSnapshotRepository;
  @Inject(CASH_FLOW_REPOSITORY)
  private readonly cashFlowRepository!: ICashFlowRepository;

  async execute(
    portfolioId: string,
    userId: string,
  ): Promise<PerformanceMetrics> {
    const portfolio = await this.portfolioRepository.findById(portfolioId);
    if (!portfolio) {
      throw new PortfolioNotFoundException(portfolioId);
    }
    if (portfolio.userId !== userId) {
      throw new PortfolioAccessDeniedException();
    }

    const snapshots =
      await this.snapshotRepository.findByPortfolioId(portfolioId);

    const empty = new PerformanceMetrics(
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

    if (snapshots.length === 0) return empty;

    const navs = snapshots.map((s) => s.nav);
    const timestamps = snapshots.map((s) => s.timestamp);
    const initialNav = portfolio.initialCapital;
    const currentNav = navs[navs.length - 1] ?? initialNav;

    const totalReturn = currentNav - initialNav;
    const totalReturnPct =
      initialNav > 0 ? (totalReturn / initialNav) * 100 : 0;

    // Max drawdown
    let peak = navs[0] ?? 0;
    let maxDrawdown = 0;
    for (const nav of navs) {
      if (nav > peak) peak = nav;
      const drawdown = peak - nav;
      if (drawdown > maxDrawdown) maxDrawdown = drawdown;
    }
    const maxDrawdownPct = peak > 0 ? (maxDrawdown / peak) * 100 : 0;

    // Daily returns
    const returns: number[] = [];
    for (let i = 1; i < navs.length; i++) {
      const prev = navs[i - 1];
      const curr = navs[i];
      if (prev && curr && prev > 0) {
        returns.push((curr - prev) / prev);
      }
    }

    let sharpe: number | null = null;
    let volatility: number | null = null;
    let sortinoRatio: number | null = null;

    if (returns.length > 1) {
      const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
      const variance =
        returns.reduce((acc, r) => acc + (r - mean) ** 2, 0) /
        (returns.length - 1); // Bessel's correction for sample variance
      const stdDev = Math.sqrt(variance);
      volatility = stdDev * Math.sqrt(252) * 100; // annualised %
      sharpe =
        stdDev > 0
          ? ((mean - RISK_FREE_DAILY) / stdDev) * Math.sqrt(252)
          : null;

      // Sortino: downside deviation only
      const negativeReturns = returns.filter((r) => r < RISK_FREE_DAILY);
      if (negativeReturns.length > 0) {
        const downsideVariance =
          negativeReturns.reduce(
            (acc, r) => acc + (r - RISK_FREE_DAILY) ** 2,
            0,
          ) / negativeReturns.length;
        const downsideStd = Math.sqrt(downsideVariance);
        sortinoRatio =
          downsideStd > 0
            ? ((mean - RISK_FREE_DAILY) / downsideStd) * Math.sqrt(252)
            : null;
      }
    }

    // Win rate: % of positive daily returns
    const winRate =
      returns.length > 0
        ? (returns.filter((r) => r > 0).length / returns.length) * 100
        : null;

    // Profit factor: sum of gains / abs(sum of losses)
    const gains = returns.filter((r) => r > 0).reduce((a, b) => a + b, 0);
    const losses = Math.abs(
      returns.filter((r) => r < 0).reduce((a, b) => a + b, 0),
    );
    const profitFactor = losses > 0 ? gains / losses : gains > 0 ? null : null;

    // CAGR
    const firstTimestamp = timestamps[0];
    const lastTimestamp = timestamps[timestamps.length - 1];
    const totalDays =
      snapshots.length > 1 && firstTimestamp && lastTimestamp
        ? (lastTimestamp.getTime() - firstTimestamp.getTime()) /
          (1000 * 60 * 60 * 24)
        : 0;
    const cagr =
      totalDays > 0 && initialNav > 0
        ? ((currentNav / initialNav) ** (365 / totalDays) - 1) * 100
        : null;

    // Calmar ratio
    const calmarRatio =
      cagr !== null && maxDrawdownPct > 0 ? cagr / maxDrawdownPct : null;

    // TWR — fetch cash flows for the period
    let twr: number | null = null;
    if (snapshots.length >= 2) {
      const firstTimestamp = timestamps[0];
      const lastTimestamp = timestamps[timestamps.length - 1];
      if (firstTimestamp && lastTimestamp) {
        const cashFlows =
          await this.cashFlowRepository.findByPortfolioIdInRange(
            portfolioId,
            firstTimestamp,
            lastTimestamp,
          );
        twr = computeTwr(navs, cashFlows, timestamps);
        if (twr !== null) twr = twr * 100; // convert to %
      }
    }

    // VaR / CVaR (historical simulation at daily level)
    const var95 = computeVaR(returns, 0.95);
    const var99 = computeVaR(returns, 0.99);
    const cvar95 = var95 !== null ? computeCVaR(returns, var95) : null;
    const cvar99 = var99 !== null ? computeCVaR(returns, var99) : null;

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
      snapshots[snapshots.length - 1]?.timestamp ?? null,
      twr,
      cagr,
      sortinoRatio,
      calmarRatio,
      profitFactor,
      var95 !== null ? var95 * 100 : null,
      var99 !== null ? var99 * 100 : null,
      cvar95 !== null ? cvar95 * 100 : null,
      cvar99 !== null ? cvar99 * 100 : null,
    );
  }
}
