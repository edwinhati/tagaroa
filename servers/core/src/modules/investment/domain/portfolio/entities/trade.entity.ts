import type { TradeSide } from "../../value-objects/trade-side.value-object";

export class Trade {
  constructor(
    public readonly id: string,
    public readonly portfolioId: string,
    public readonly positionId: string | null,
    public readonly instrumentId: string,
    public readonly side: TradeSide,
    public readonly quantity: number,
    public readonly price: number,
    public readonly fees: number,
    public readonly realizedPnl: number | null,
    public readonly timestamp: Date,
    public readonly createdAt: Date,
  ) {}
}
