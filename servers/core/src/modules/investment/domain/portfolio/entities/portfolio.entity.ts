import type { PortfolioMode } from "../../value-objects/portfolio-mode.value-object";
import type { PortfolioStatus } from "../../value-objects/portfolio-status.value-object";

export class Portfolio {
  constructor(
    public readonly id: string,
    public readonly userId: string,
    public readonly name: string,
    public readonly mode: PortfolioMode,
    public readonly initialCapital: number,
    public readonly currency: string,
    public readonly status: PortfolioStatus,
    public readonly deletedAt: Date | null,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
    public readonly version: number,
  ) {}

  static create(
    id: string,
    userId: string,
    name: string,
    mode: PortfolioMode,
    initialCapital: number,
    currency: string,
  ): Portfolio {
    if (!name || name.trim().length === 0) {
      throw new Error("Portfolio name is required");
    }
    if (initialCapital < 0) {
      throw new Error("Initial capital must be non-negative");
    }

    const now = new Date();
    return new Portfolio(
      id,
      userId,
      name,
      mode,
      initialCapital,
      currency,
      "ACTIVE" as PortfolioStatus,
      null,
      now,
      now,
      1,
    );
  }

  isActive(): boolean {
    return this.deletedAt === null;
  }
}
