import type { CashFlowType } from "../../value-objects/cash-flow-type.value-object";

export class CashFlow {
  constructor(
    public readonly id: string,
    public readonly portfolioId: string,
    public readonly type: CashFlowType,
    public readonly amount: number,
    public readonly description: string | null,
    public readonly timestamp: Date,
    public readonly createdAt: Date,
  ) {}
}
