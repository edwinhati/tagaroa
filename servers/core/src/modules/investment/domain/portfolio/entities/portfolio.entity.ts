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

  isActive(): boolean {
    return this.deletedAt === null;
  }
}
