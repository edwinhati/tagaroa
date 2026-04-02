import type { InferSelectModel } from "drizzle-orm";
import { CashFlow } from "../../../../domain/portfolio/entities/cash-flow.entity";
import type { CashFlowType } from "../../../../domain/value-objects/cash-flow-type.value-object";
import type { cashFlows } from "../schemas/cash-flow.schema";

type CashFlowRow = InferSelectModel<typeof cashFlows>;

function mapCashFlowToDomain(row: CashFlowRow): CashFlow {
  return new CashFlow(
    row.id,
    row.portfolioId,
    row.type as CashFlowType,
    Number(row.amount),
    row.description ?? null,
    row.timestamp,
    row.createdAt ?? new Date(),
  );
}

function mapCashFlowToPersistence(
  entity: CashFlow,
): Omit<CashFlowRow, "createdAt"> {
  return {
    id: entity.id,
    portfolioId: entity.portfolioId,
    type: entity.type,
    amount: String(entity.amount),
    description: entity.description,
    timestamp: entity.timestamp,
  };
}

export const CashFlowMapper = {
  toDomain: mapCashFlowToDomain,
  toPersistence: mapCashFlowToPersistence,
};
