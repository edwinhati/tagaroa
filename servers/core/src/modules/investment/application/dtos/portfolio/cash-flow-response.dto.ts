import type { CashFlow } from "../../../domain/portfolio/entities/cash-flow.entity";

export type CashFlowResponseDto = {
  id: string;
  portfolio_id: string;
  type: string;
  amount: number;
  description: string | null;
  timestamp: Date;
  created_at: Date;
};

export function toCashFlowResponse(cashFlow: CashFlow): CashFlowResponseDto {
  return {
    id: cashFlow.id,
    portfolio_id: cashFlow.portfolioId,
    type: cashFlow.type,
    amount: cashFlow.amount,
    description: cashFlow.description,
    timestamp: cashFlow.timestamp,
    created_at: cashFlow.createdAt,
  };
}
