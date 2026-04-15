import type { InstallmentData } from "../entities/transaction.entity";
import type { Currency } from "../value-objects/currency";
import type { TransactionType } from "../value-objects/transaction-type";

export class TransactionCreatedEvent {
  constructor(
    public readonly transactionId: string,
    public readonly userId: string,
    public readonly accountId: string,
    public readonly budgetItemId: string | null,
    public readonly amount: number,
    public readonly type: TransactionType,
    public readonly currency: Currency,
    public readonly installment: InstallmentData | null,
  ) {}
}
