export class PortfolioSnapshot {
  constructor(
    public readonly id: string,
    public readonly portfolioId: string,
    public readonly userId: string,
    public readonly timestamp: Date,
    public readonly nav: number,
    public readonly cash: number,
    public readonly positionsSnapshot: Record<string, unknown> | null,
    public readonly createdAt: Date,
    public readonly version: number,
  ) {}

  toEvent(currency: string): any {
    return {
      type: "portfolio",
      userId: this.userId,
      sourceId: this.portfolioId,
      snapshotDate: this.timestamp,
      baseCurrency: currency,
      nav: this.nav,
      cash: this.cash,
      positions: this.positionsSnapshot
        ? Object.values(this.positionsSnapshot)
        : [],
    };
  }
}
