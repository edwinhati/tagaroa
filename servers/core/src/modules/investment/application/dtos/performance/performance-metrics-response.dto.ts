import type { PerformanceMetrics } from "../../../domain/performance/entities/performance-metrics.entity";

export type PerformanceMetricsResponseDto = {
  portfolio_id: string;
  total_return: number;
  total_return_pct: number;
  sharpe_ratio: number | null;
  max_drawdown: number;
  max_drawdown_pct: number;
  volatility: number | null;
  win_rate: number | null;
  snapshot_count: number;
  period_start: Date | null;
  period_end: Date | null;
  twr: number | null;
  cagr: number | null;
  sortino_ratio: number | null;
  calmar_ratio: number | null;
  profit_factor: number | null;
  var_95: number | null;
  var_99: number | null;
  cvar_95: number | null;
  cvar_99: number | null;
};

export function toPerformanceMetricsResponse(
  metrics: PerformanceMetrics,
): PerformanceMetricsResponseDto {
  return {
    portfolio_id: metrics.portfolioId,
    total_return: metrics.totalReturn,
    total_return_pct: metrics.totalReturnPct,
    sharpe_ratio: metrics.sharpeRatio,
    max_drawdown: metrics.maxDrawdown,
    max_drawdown_pct: metrics.maxDrawdownPct,
    volatility: metrics.volatility,
    win_rate: metrics.winRate,
    snapshot_count: metrics.snapshotCount,
    period_start: metrics.periodStart,
    period_end: metrics.periodEnd,
    twr: metrics.twr,
    cagr: metrics.cagr,
    sortino_ratio: metrics.sortinoRatio,
    calmar_ratio: metrics.calmarRatio,
    profit_factor: metrics.profitFactor,
    var_95: metrics.var95,
    var_99: metrics.var99,
    cvar_95: metrics.cvar95,
    cvar_99: metrics.cvar99,
  };
}
