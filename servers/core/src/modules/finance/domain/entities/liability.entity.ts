import type { Currency } from "../value-objects/currency";

export class Liability {
  constructor(
    public readonly id: string,
    public readonly userId: string,
    public readonly name: string,
    public readonly type: string,
    public readonly amount: number,
    public readonly currency: Currency,
    public readonly paidAt: Date | null,
    public readonly notes: string | null,
    public readonly deletedAt: Date | null,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
    public readonly version: number,
  ) {}

  isActive(): boolean {
    return this.deletedAt === null && this.paidAt === null;
  }

  getCurrentAmount(): number {
    return this.amount;
  }
}
