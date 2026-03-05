import type { Currency } from "../value-objects/currency";

export class Asset {
  constructor(
    public readonly id: string,
    public readonly userId: string,
    public readonly name: string,
    public readonly type: string,
    public readonly value: number,
    public readonly shares: number | null,
    public readonly ticker: string | null,
    public readonly currency: Currency,
    public readonly notes: string | null,
    public readonly deletedAt: Date | null,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
    public readonly version: number,
  ) {}

  isActive(): boolean {
    return this.deletedAt === null;
  }

  getCurrentValue(): number {
    return this.value;
  }
}
