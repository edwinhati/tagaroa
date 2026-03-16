/**
 * Metadata for credit/liability accounts (credit cards, pay-later services)
 */
export type CreditAccountMetadata = {
  /** Maximum credit limit */
  creditLimit?: number;
  /** Currently available credit (calculated: creditLimit + balance where balance is negative) */
  availableCredit?: number;
  /** Day of the month when the billing cycle ends (1-31) */
  billingCycleDay?: number;
  /** Minimum payment due for current period */
  minimumPayment?: number;
  /** Next payment due date */
  nextDueDate?: Date;
  /** Annual interest rate (APR) as percentage */
  interestRate?: number;
};

/**
 * Metadata for asset accounts (bank, e-wallet, cash)
 */
export type AssetAccountMetadata = {
  /** Account number (masked) */
  accountNumber?: string;
  /** Bank or provider name */
  provider?: string;
  /** Whether this is the primary/default account */
  isDefault?: boolean;
  /** Monthly interest rate if applicable */
  interestRate?: number;
};

/**
 * Union type for all account metadata
 */
export type AccountMetadata =
  | CreditAccountMetadata
  | AssetAccountMetadata
  | Record<string, unknown>;

/**
 * Type guard for credit account metadata
 */
export function isCreditAccountMetadata(
  metadata: AccountMetadata | null | undefined,
): metadata is CreditAccountMetadata {
  if (!metadata) return false;
  const creditMeta = metadata as CreditAccountMetadata;
  return (
    creditMeta.creditLimit !== undefined ||
    creditMeta.availableCredit !== undefined ||
    creditMeta.billingCycleDay !== undefined ||
    creditMeta.minimumPayment !== undefined ||
    creditMeta.nextDueDate !== undefined
  );
}

/**
 * Type guard for asset account metadata
 */
export function isAssetAccountMetadata(
  metadata: AccountMetadata | null | undefined,
): metadata is AssetAccountMetadata {
  if (!metadata) return false;
  const assetMeta = metadata as AssetAccountMetadata;
  return (
    assetMeta.accountNumber !== undefined ||
    assetMeta.provider !== undefined ||
    assetMeta.isDefault !== undefined
  );
}

/**
 * Calculate available credit based on credit limit and current balance
 * Note: For liability accounts, balance is typically negative (money owed)
 */
export function calculateAvailableCredit(
  creditLimit: number,
  balance: number,
): number {
  // Balance is negative for credit accounts (money owed)
  // Available = Credit Limit - Amount Owed = Credit Limit + Balance
  return Math.max(0, creditLimit + balance);
}

/**
 * Calculate credit utilization percentage
 */
export function calculateCreditUtilization(
  creditLimit: number,
  balance: number,
): number {
  if (creditLimit <= 0) return 0;
  // Balance is negative for credit accounts, so utilization = -balance / creditLimit
  const amountOwed = Math.abs(Math.min(0, balance));
  return Math.min(100, (amountOwed / creditLimit) * 100);
}

/**
 * Get utilization color based on percentage
 * - Green: < 30%
 * - Amber: 30-70%
 * - Red: > 70%
 */
export function getUtilizationColor(
  utilization: number,
): "green" | "amber" | "red" {
  if (utilization < 30) return "green";
  if (utilization <= 70) return "amber";
  return "red";
}
