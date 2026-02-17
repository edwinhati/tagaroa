export class Budget {
  constructor(
    public readonly id: string,
    public readonly month: number,
    public readonly year: number,
    public readonly amount: number,
    public readonly userId: string,
    public readonly currency: string,
    public readonly deletedAt: Date | null,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
    public readonly version: number,
  ) {}
}
