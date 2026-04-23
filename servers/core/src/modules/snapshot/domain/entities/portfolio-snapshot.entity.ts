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
    public readonly archivedAt: Date | null = null,
    public readonly s3Key: string | null = null,
  ) {}

  toEvent(currency: string): {
    type: "portfolio";
    userId: string;
    sourceId: string;
    snapshotDate: Date;
    baseCurrency: string;
    nav: number;
    cash: number;
    positions: unknown[];
    archivedAt: Date | null;
    s3Key: string | null;
  } {
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
      archivedAt: this.archivedAt,
      s3Key: this.s3Key,
    };
  }

  markAsArchived(s3Key: string): PortfolioSnapshot {
    return new PortfolioSnapshot(
      this.id,
      this.portfolioId,
      this.userId,
      this.timestamp,
      this.nav,
      this.cash,
      this.positionsSnapshot,
      this.createdAt,
      this.version,
      new Date(),
      s3Key,
    );
  }
}
