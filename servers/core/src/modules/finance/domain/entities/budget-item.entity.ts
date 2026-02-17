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
  ) {}
}
