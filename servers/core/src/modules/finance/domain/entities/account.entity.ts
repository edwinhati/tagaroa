import type { AccountCategory } from "../value-objects/account-category";
import type { AccountMetadata } from "../value-objects/credit-metadata";
import {
  calculateAvailableCredit,
  calculateCreditUtilization,
  isCreditAccountMetadata,
} from "../value-objects/credit-metadata";

export class Account {
  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly type: string,
    public readonly category: AccountCategory,
    public readonly balance: number,
    public readonly userId: string,
    public readonly currency: string,
    public readonly notes: string | null,
    public readonly metadata: AccountMetadata | null,
    public readonly deletedAt: Date | null,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
    public readonly version: number,
  ) {}

  /**
   * Check if this is a liability account (credit card, pay-later, etc.)
   */
  isLiability(): boolean {
    return this.category === "LIABILITY";
  }

  /**
   * Check if this is an asset account (bank, e-wallet, cash)
   */
  isAsset(): boolean {
    return this.category === "ASSET";
  }

  /**
   * Get available credit for credit accounts
   * Returns null for non-credit accounts
   */
  getAvailableCredit(): number | null {
    if (!this.isLiability() || !isCreditAccountMetadata(this.metadata)) {
      return null;
    }
    // Use stored available credit or calculate from credit limit
    if (this.metadata.availableCredit !== undefined) {
      return this.metadata.availableCredit;
    }
    if (this.metadata.creditLimit !== undefined) {
      return calculateAvailableCredit(this.metadata.creditLimit, this.balance);
    }
    return null;
  }

  /**
   * Get credit utilization percentage for credit accounts
   * Returns null for non-credit accounts
   */
  getCreditUtilization(): number | null {
    if (!this.isLiability() || !isCreditAccountMetadata(this.metadata)) {
      return null;
    }
    if (
      this.metadata.creditLimit !== undefined &&
      this.metadata.creditLimit > 0
    ) {
      return calculateCreditUtilization(
        this.metadata.creditLimit,
        this.balance,
      );
    }
    return null;
  }

  /**
   * Get the next due date for credit accounts
   */
  getNextDueDate(): Date | null {
    if (!this.isLiability() || !isCreditAccountMetadata(this.metadata)) {
      return null;
    }
    return this.metadata.nextDueDate ?? null;
  }

  /**
   * Get the billing cycle day (1-31) for credit accounts
   */
  getBillingCycleDay(): number | null {
    if (!this.isLiability() || !isCreditAccountMetadata(this.metadata)) {
      return null;
    }
    return this.metadata.billingCycleDay ?? null;
  }

  /**
   * Get the minimum payment due for credit accounts
   */
  getMinimumPayment(): number | null {
    if (!this.isLiability() || !isCreditAccountMetadata(this.metadata)) {
      return null;
    }
    return this.metadata.minimumPayment ?? null;
  }
}
