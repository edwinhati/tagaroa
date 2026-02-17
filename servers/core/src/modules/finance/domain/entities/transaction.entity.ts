import { Currency } from "../value-objects/currency";
import { TransactionType } from "../value-objects/transaction-type";

export class Transaction {
  constructor(
    public readonly id: string,
    public readonly amount: number,
    public readonly date: Date,
    public readonly notes: string | null,
    public readonly currency: Currency,
    public readonly type: TransactionType,
    public readonly files: string[] | null,
    public readonly userId: string,
    public readonly accountId: string,
    public readonly budgetItemId: string | null,
    public readonly deletedAt: Date | null,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
    public readonly version: number,
  ) {}
}
