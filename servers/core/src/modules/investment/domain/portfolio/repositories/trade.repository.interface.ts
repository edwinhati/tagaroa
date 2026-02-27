import type { Trade } from "../entities/trade.entity";

export const TRADE_REPOSITORY = Symbol("TRADE_REPOSITORY");

export interface ITradeRepository {
  findById(id: string): Promise<Trade | null>;
  findByPortfolioId(
    portfolioId: string,
    offset?: number,
    limit?: number,
  ): Promise<Trade[]>;
  findByPositionId(positionId: string): Promise<Trade[]>;
  create(trade: Trade): Promise<Trade>;
  createMany(trades: Trade[]): Promise<Trade[]>;
}
