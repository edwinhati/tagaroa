import { Currency } from "../value-objects/currency";

export class NetWorthSnapshot {
  constructor(
    public readonly id: string,
    public readonly userId: string,
    public readonly snapshotDate: Date,
    public readonly totalAssets: number,
    public readonly totalLiabilities: number,
    public readonly netWorth: number,
    public readonly currency: Currency,
    public readonly createdAt: Date,
  ) {}

  getNetWorth(): number {
    return this.netWorth;
  }
}
