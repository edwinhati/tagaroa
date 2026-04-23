export class PortfolioSnapshot {
  constructor(
    public readonly id: string,
    public readonly portfolioId: string,
    public readonly timestamp: Date,
    public readonly nav: number,
    public readonly cash: number,
    public readonly positionsSnapshot: Record<string, unknown> | null,
    public readonly createdAt: Date,
    public readonly version: number,
  ) {}

  toEvent(
    userId: string,
    baseCurrency: string,
  ): {
    type: "portfolio";
    userId: string;
    sourceId: string;
    snapshotDate: Date;
    baseCurrency: string;
    nav: number;
    cash: number;
    positions: Array<{
      instrumentId: string;
      quantity: number;
      averageCost: number;
      side: string;
    }>;
  } {
    const positions: Array<{
      instrumentId: string;
      quantity: number;
      averageCost: number;
      side: string;
    }> = [];

    if (this.positionsSnapshot) {
      for (const [, value] of Object.entries(this.positionsSnapshot)) {
        const pos = value as Record<string, unknown>;
        positions.push({
          instrumentId: String(pos.instrumentId),
          quantity: Number(pos.quantity),
          averageCost: Number(pos.averageCost),
          side: String(pos.side),
        });
      }
    }

    return {
      type: "portfolio",
      userId,
      sourceId: this.portfolioId,
      snapshotDate: this.timestamp,
      baseCurrency,
      nav: this.nav,
      cash: this.cash,
      positions,
    };
  }
}
