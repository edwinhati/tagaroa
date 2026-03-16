import type { Currency } from "../value-objects/currency";

export type InstallmentMetadata = {
  tenure: number;
  interestRate: number;
  monthlyAmount: number;
};

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
    // Installment-related fields
    public readonly transactionId: string | null = null,
    public readonly installmentNumber: number | null = null,
    public readonly originalAmount: number | null = null,
    public readonly totalInterest: number | null = null,
    public readonly totalAmount: number | null = null,
    public readonly remainingMonths: number | null = null,
    public readonly installmentMetadata: InstallmentMetadata | null = null,
    public readonly dueAt: Date | null = null,
  ) {}

  isActive(): boolean {
    return this.deletedAt === null && this.paidAt === null;
  }

  getCurrentAmount(): number {
    return this.amount;
  }

  /**
   * Check if this liability is an installment from a transaction
   */
  isInstallment(): boolean {
    return this.transactionId !== null;
  }

  /**
   * Get installment progress as percentage
   */
  getInstallmentProgress(): number | null {
    if (!this.isInstallment() || this.installmentMetadata === null) {
      return null;
    }
    const totalMonths = this.installmentMetadata.tenure;
    const remaining = this.remainingMonths ?? totalMonths;
    const paidMonths = totalMonths - remaining;
    return Math.round((paidMonths / totalMonths) * 100);
  }
}
