import type { BudgetItem } from "./budget-item.entity";

export class Budget {
  private _items: BudgetItem[] = [];

  constructor(
    public readonly id: string,
    public readonly month: number,
    public readonly year: number,
    public readonly amount: number,
    public readonly userId: string,
    public readonly currency: string,
    items: BudgetItem[] | undefined,
    public readonly deletedAt: Date | null,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
    public readonly version: number,
  ) {
    this._items = items ?? [];
  }

  static create(
    id: string,
    month: number,
    year: number,
    amount: number,
    userId: string,
    currency: string,
  ): Budget {
    if (month < 1 || month > 12) {
      throw new Error("Month must be between 1 and 12");
    }
    if (year < 2000 || year > 2100) {
      throw new Error("Year must be between 2000 and 2100");
    }
    if (amount < 0) {
      throw new Error("Amount must be non-negative");
    }

    const now = new Date();
    return new Budget(
      id,
      month,
      year,
      amount,
      userId,
      currency,
      [],
      null,
      now,
      now,
      1,
    );
  }

  addItem(item: BudgetItem): void {
    if (this._items.some((i) => i.category === item.category)) {
      throw new Error(
        `Budget already has an item for category ${item.category}`,
      );
    }

    if (this.totalAllocated() + item.allocation > this.amount) {
      throw new Error("Budget amount exceeded by item allocations");
    }

    this._items.push(item);
  }

  removeItem(itemId: string): void {
    this._items = this._items.filter((item) => item.id !== itemId);
  }

  totalAllocated(): number {
    return this._items.reduce((sum, item) => sum + item.allocation, 0);
  }

  utilizationPercentage(): number {
    if (this.amount === 0) return 0;
    return (this.totalAllocated() / this.amount) * 100;
  }

  isOverallocated(): boolean {
    return this.totalAllocated() > this.amount;
  }

  get items(): ReadonlyArray<BudgetItem> {
    return this._items;
  }
}
