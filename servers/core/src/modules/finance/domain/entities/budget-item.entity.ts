export class BudgetItem {
  constructor(
    public readonly id: string,
    public readonly budgetId: string,
    public readonly category: string,
    public readonly allocation: number,
    public readonly spent: number,
    public readonly deletedAt: Date | null,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
    public readonly version: number,
  ) {}

  /**
   * Create a new BudgetItem with an updated spent amount.
   * Immutable — returns a new instance.
   */
  withUpdatedSpent(spent: number): BudgetItem {
    return new BudgetItem(
      this.id,
      this.budgetId,
      this.category,
      this.allocation,
      spent,
      this.deletedAt,
      this.createdAt,
      new Date(),
      this.version + 1,
    );
  }
}
