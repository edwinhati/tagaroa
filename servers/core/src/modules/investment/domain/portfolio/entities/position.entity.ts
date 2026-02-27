import type { PositionSide } from "../../value-objects/position-side.value-object";

export class Position {
  constructor(
    public readonly id: string,
    public readonly portfolioId: string,
    public readonly instrumentId: string,
    public readonly quantity: number,
    public readonly averageCost: number,
    public readonly side: PositionSide,
    public readonly openedAt: Date,
    public readonly closedAt: Date | null,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
  ) {}

  isOpen(): boolean {
    return this.closedAt === null;
  }

  marketValue(currentPrice: number): number {
    return this.quantity * currentPrice;
  }

  unrealizedPnl(currentPrice: number): number {
    const costBasis = this.quantity * this.averageCost;
    const mv = this.marketValue(currentPrice);
    return this.side === "LONG" ? mv - costBasis : costBasis - mv;
  }
}
