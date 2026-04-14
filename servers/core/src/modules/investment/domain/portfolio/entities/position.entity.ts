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
    public readonly version: number,
  ) {}

  static create(
    portfolioId: string,
    instrumentId: string,
    quantity: number,
    averageCost: number,
    side: PositionSide,
  ): Position {
    if (quantity <= 0) {
      throw new Error("Position quantity must be positive");
    }
    if (averageCost < 0) {
      throw new Error("Position average cost cannot be negative");
    }

    const now = new Date();
    return new Position(
      crypto.randomUUID(),
      portfolioId,
      instrumentId,
      quantity,
      averageCost,
      side,
      now,
      null,
      now,
      now,
      1,
    );
  }

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

  consolidate(other: Position): Position {
    if (this.side !== other.side) {
      throw new Error("Cannot consolidate positions with different sides");
    }
    if (this.instrumentId !== other.instrumentId) {
      throw new Error("Cannot consolidate positions for different instruments");
    }
    if (this.portfolioId !== other.portfolioId) {
      throw new Error("Cannot consolidate positions from different portfolios");
    }
    if (!this.isOpen()) {
      throw new Error("Cannot consolidate into a closed position");
    }

    const totalQty = this.quantity + other.quantity;
    const weightedAvgCost =
      (this.quantity * this.averageCost + other.quantity * other.averageCost) /
      totalQty;

    return new Position(
      this.id,
      this.portfolioId,
      this.instrumentId,
      totalQty,
      weightedAvgCost,
      this.side,
      this.openedAt,
      this.closedAt,
      this.createdAt,
      new Date(),
      this.version + 1,
    );
  }

  close(_price: number): Position {
    if (!this.isOpen()) {
      throw new Error("Position is already closed");
    }

    return new Position(
      this.id,
      this.portfolioId,
      this.instrumentId,
      this.quantity,
      this.averageCost,
      this.side,
      this.openedAt,
      new Date(),
      this.createdAt,
      new Date(),
      this.version + 1,
    );
  }
}
