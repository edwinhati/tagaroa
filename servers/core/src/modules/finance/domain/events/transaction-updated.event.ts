import type { TransactionType } from "../value-objects/transaction-type";

export class TransactionUpdatedEvent {
  constructor(
    public readonly transactionId: string,
    public readonly userId: string,
    public readonly previousAccountId: string,
    public readonly previousBudgetItemId: string | null,
    public readonly previousAmount: number,
    public readonly previousType: TransactionType,
    public readonly newAccountId: string,
    public readonly newBudgetItemId: string | null,
    public readonly newAmount: number,
    public readonly newType: TransactionType,
  ) {}
}
