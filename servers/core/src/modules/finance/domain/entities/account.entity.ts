export class Account {
  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly type: string,
    public readonly balance: number,
    public readonly userId: string,
    public readonly currency: string,
    public readonly notes: string | null,
    public readonly deletedAt: Date | null,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
    public readonly version: number,
  ) {}
}
