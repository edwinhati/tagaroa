export class PerformanceMetrics {
  constructor(
    public readonly portfolioId: string,
    public readonly totalReturn: number,
    public readonly totalReturnPct: number,
    public readonly sharpeRatio: number | null,
    public readonly maxDrawdown: number,
    public readonly maxDrawdownPct: number,
    public readonly volatility: number | null,
    public readonly winRate: number | null,
    public readonly snapshotCount: number,
    public readonly periodStart: Date | null,
    public readonly periodEnd: Date | null,
    // Phase 3 additions
    public readonly twr: number | null,
    public readonly cagr: number | null,
    public readonly sortinoRatio: number | null,
    public readonly calmarRatio: number | null,
    public readonly profitFactor: number | null,
    public readonly var95: number | null,
    public readonly var99: number | null,
    public readonly cvar95: number | null,
    public readonly cvar99: number | null,
  ) {}
}
