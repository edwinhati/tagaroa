import type { InferSelectModel } from "drizzle-orm";
import { Trade } from "../../../../domain/portfolio/entities/trade.entity";
import type { TradeSide } from "../../../../domain/value-objects/trade-side.value-object";
import type { trades } from "../schemas/trade.schema";

type TradeRow = InferSelectModel<typeof trades>;

function mapTradeToDomain(row: TradeRow): Trade {
  return new Trade(
    row.id,
    row.portfolioId,
    row.positionId ?? null,
    row.instrumentId,
    row.side as TradeSide,
    Number(row.quantity),
    Number(row.price),
    Number(row.fees),
    row.realizedPnl == null ? null : Number(row.realizedPnl),
    row.timestamp,
    row.createdAt ?? new Date(),
  );
}

function mapTradeToPersistence(entity: Trade): Omit<TradeRow, "createdAt"> {
  return {
    id: entity.id,
    portfolioId: entity.portfolioId,
    positionId: entity.positionId,
    instrumentId: entity.instrumentId,
    side: entity.side,
    quantity: String(entity.quantity),
    price: String(entity.price),
    fees: String(entity.fees),
    realizedPnl: entity.realizedPnl == null ? null : String(entity.realizedPnl),
    timestamp: entity.timestamp,
  };
}

export const TradeMapper = {
  toDomain: mapTradeToDomain,
  toPersistence: mapTradeToPersistence,
};
