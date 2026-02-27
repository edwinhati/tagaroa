import type { CashFlow } from "../entities/cash-flow.entity";

export const CASH_FLOW_REPOSITORY = Symbol("CASH_FLOW_REPOSITORY");

export interface ICashFlowRepository {
  findById(id: string): Promise<CashFlow | null>;
  findByPortfolioId(
    portfolioId: string,
    offset?: number,
    limit?: number,
  ): Promise<CashFlow[]>;
  findByPortfolioIdInRange(
    portfolioId: string,
    start: Date,
    end: Date,
  ): Promise<CashFlow[]>;
  create(cashFlow: CashFlow): Promise<CashFlow>;
  delete(id: string): Promise<void>;
}
