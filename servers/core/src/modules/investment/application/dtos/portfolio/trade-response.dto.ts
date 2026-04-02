import type { Trade } from "../../../domain/portfolio/entities/trade.entity";

type TradeResponseDto = {
  id: string;
  portfolio_id: string;
  position_id: string | null;
  instrument_id: string;
  side: string;
  quantity: number;
  price: number;
  fees: number;
  realized_pnl: number | null;
  timestamp: Date;
  created_at: Date;
};

export function toTradeResponse(trade: Trade): TradeResponseDto {
  return {
    id: trade.id,
    portfolio_id: trade.portfolioId,
    position_id: trade.positionId,
    instrument_id: trade.instrumentId,
    side: trade.side,
    quantity: trade.quantity,
    price: trade.price,
    fees: trade.fees,
    realized_pnl: trade.realizedPnl,
    timestamp: trade.timestamp,
    created_at: trade.createdAt,
  };
}
