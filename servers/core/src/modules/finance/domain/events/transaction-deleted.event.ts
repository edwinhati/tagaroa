import type { TransactionType } from "../value-objects/transaction-type";

export class TransactionDeletedEvent {
  constructor(
    public readonly transactionId: string,
    public readonly userId: string,
    public readonly accountId: string,
    public readonly budgetItemId: string | null,
    public readonly amount: number,
    public readonly type: TransactionType,
  ) {}
}
