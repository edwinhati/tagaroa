import { Inject, Injectable } from "@nestjs/common";
import {
  PortfolioAccessDeniedException,
  PortfolioNotFoundException,
} from "../../../domain/exceptions/investment.exceptions";
import {
  type IPortfolioSnapshotRepository,
  PORTFOLIO_SNAPSHOT_REPOSITORY,
} from "../../../domain/performance/repositories/snapshot.repository.interface";
import {
  type IPortfolioRepository,
  PORTFOLIO_REPOSITORY,
} from "../../../domain/portfolio/repositories/portfolio.repository.interface";

const RISK_FREE_DAILY = 0.02 / 252;

interface RollingMetrics {
  windowDays: number;
  sharpe: number | null;
  volatility: number | null;
  maxDrawdown: number | null;
  totalReturn: number | null;
}

function computeMetrics(navs: number[]): Omit<RollingMetrics, "windowDays"> {
  if (navs.length < 2)
    return {
      sharpe: null,
      volatility: null,
      maxDrawdown: null,
      totalReturn: null,
    };

  const returns: number[] = [];
  for (let i = 1; i < navs.length; i++) {
    const prev = navs[i - 1];
    const curr = navs[i];
    if (prev !== undefined && curr !== undefined && prev > 0) {
      returns.push((curr - prev) / prev);
    }
  }

  if (returns.length < 2)
    return {
      sharpe: null,
      volatility: null,
      maxDrawdown: null,
      totalReturn: null,
    };

  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance =
    returns.reduce((acc, r) => acc + (r - mean) ** 2, 0) / (returns.length - 1);
  const stdDev = Math.sqrt(variance);
  const volatility = stdDev * Math.sqrt(252) * 100;
  const sharpe =
    stdDev > 0 ? ((mean - RISK_FREE_DAILY) / stdDev) * Math.sqrt(252) : null;

  const firstNav = navs[0] ?? 0;
  let peak = firstNav;
  let maxDrawdownPct = 0;
  for (const nav of navs) {
    if (nav > peak) peak = nav;
    const dd = peak > 0 ? ((peak - nav) / peak) * 100 : 0;
    if (dd > maxDrawdownPct) maxDrawdownPct = dd;
  }

  const lastNav = navs.at(-1) ?? 0;
  const totalReturn =
    firstNav > 0 ? ((lastNav - firstNav) / firstNav) * 100 : null;

  return { sharpe, volatility, maxDrawdown: maxDrawdownPct, totalReturn };
}

@Injectable()
export class GetRollingMetricsUseCase {
  constructor(
    @Inject(PORTFOLIO_REPOSITORY)
    private readonly portfolioRepository: IPortfolioRepository,
    @Inject(PORTFOLIO_SNAPSHOT_REPOSITORY)
    private readonly snapshotRepository: IPortfolioSnapshotRepository,
  ) {}

  async execute(
    portfolioId: string,
    userId: string,
    windowDays: number,
  ): Promise<RollingMetrics> {
    const portfolio = await this.portfolioRepository.findById(portfolioId);
    if (!portfolio) throw new PortfolioNotFoundException(portfolioId);
    if (portfolio.userId !== userId) throw new PortfolioAccessDeniedException();

    const cutoff = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);
    const all = await this.snapshotRepository.findByPortfolioId(portfolioId);
    const window = all.filter((s) => s.timestamp >= cutoff);

    if (window.length < 2) {
      return {
        windowDays,
        sharpe: null,
        volatility: null,
        maxDrawdown: null,
        totalReturn: null,
      };
    }

    const navs = window.map((s) => s.nav);
    return { windowDays, ...computeMetrics(navs) };
  }
}
