import type { InferSelectModel } from "drizzle-orm";
import { Position } from "../../../../domain/portfolio/entities/position.entity";
import type { PositionSide } from "../../../../domain/value-objects/position-side.value-object";
import type { positions } from "../schemas/position.schema";

type PositionRow = InferSelectModel<typeof positions>;

export function mapPositionToDomain(row: PositionRow): Position {
  return new Position(
    row.id,
    row.portfolioId,
    row.instrumentId,
    Number(row.quantity),
    Number(row.averageCost),
    row.side as PositionSide,
    row.openedAt,
    row.closedAt ?? null,
    row.createdAt ?? new Date(),
    row.updatedAt ?? new Date(),
  );
}

export function mapPositionToPersistence(
  entity: Position,
): Omit<PositionRow, "createdAt" | "updatedAt"> {
  return {
    id: entity.id,
    portfolioId: entity.portfolioId,
    instrumentId: entity.instrumentId,
    quantity: String(entity.quantity),
    averageCost: String(entity.averageCost),
    side: entity.side,
    openedAt: entity.openedAt,
    closedAt: entity.closedAt,
  };
}

export const PositionMapper = {
  toDomain: mapPositionToDomain,
  toPersistence: mapPositionToPersistence,
};
