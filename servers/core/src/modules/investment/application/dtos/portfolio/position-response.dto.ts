import type { Position } from "../../../domain/portfolio/entities/position.entity";

export type PositionResponseDto = {
  id: string;
  portfolio_id: string;
  instrument_id: string;
  quantity: number;
  average_cost: number;
  side: string;
  opened_at: Date;
  closed_at: Date | null;
  created_at: Date;
  updated_at: Date;
};

export function toPositionResponse(position: Position): PositionResponseDto {
  return {
    id: position.id,
    portfolio_id: position.portfolioId,
    instrument_id: position.instrumentId,
    quantity: position.quantity,
    average_cost: position.averageCost,
    side: position.side,
    opened_at: position.openedAt,
    closed_at: position.closedAt,
    created_at: position.createdAt,
    updated_at: position.updatedAt,
  };
}
