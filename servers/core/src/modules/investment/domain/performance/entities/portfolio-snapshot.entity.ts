export class PortfolioSnapshot {
  constructor(
    public readonly id: string,
    public readonly portfolioId: string,
    public readonly timestamp: Date,
    public readonly nav: number,
    public readonly cash: number,
    public readonly positionsSnapshot: Record<string, unknown> | null,
    public readonly createdAt: Date,
  ) {}
}
