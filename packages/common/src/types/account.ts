import type {
  AggregationItem,
  JsonApiResponse,
  PaginationInfo,
} from "@repo/common/types";
import { z } from "zod";

// Account category enum
export const AccountCategory = {
  ASSET: "ASSET",
  LIABILITY: "LIABILITY",
  OTHER: "OTHER",
} as const;

export type AccountCategory =
  (typeof AccountCategory)[keyof typeof AccountCategory];

// Credit account metadata
export type CreditAccountMetadata = {
  creditLimit?: number;
  availableCredit?: number;
  billingCycleDay?: number;
  minimumPayment?: number;
  nextDueDate?: string;
  interestRate?: number;
};

// Asset account metadata
export type AssetAccountMetadata = {
  accountNumber?: string;
  provider?: string;
  isDefault?: boolean;
  interestRate?: number;
};

// Union type for all account metadata
export type AccountMetadata =
  | CreditAccountMetadata
  | AssetAccountMetadata
  | Record<string, unknown>;

// Helper to check if metadata is credit metadata
export function isCreditMetadata(
  metadata: AccountMetadata | null | undefined,
): metadata is CreditAccountMetadata {
  if (!metadata) return false;
  return (
    "creditLimit" in metadata ||
    "availableCredit" in metadata ||
    "billingCycleDay" in metadata
  );
}

// Helper to get utilization color
export function getUtilizationColor(
  utilization: number,
): "green" | "amber" | "red" {
  if (utilization < 30) return "green";
  if (utilization <= 70) return "amber";
  return "red";
}

// Calculate credit utilization
export function calculateCreditUtilization(
  creditLimit: number,
  balance: number,
): number {
  if (creditLimit <= 0) return 0;
  const amountOwed = Math.abs(Math.min(0, balance));
  return Math.min(100, (amountOwed / creditLimit) * 100);
}

// Calculate available credit
export function calculateAvailableCredit(
  creditLimit: number,
  balance: number,
): number {
  return Math.max(0, creditLimit + balance);
}

// Map account types to their corresponding categories
export function getAccountCategoryFromType(type: string): AccountCategory {
  const liabilityTypes = new Set(["CREDIT-CARD", "PAY-LATER"]);
  if (liabilityTypes.has(type)) {
    return AccountCategory.LIABILITY;
  }
  return AccountCategory.ASSET;
}

export const accountSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, "Name is required"),
  type: z.string(),
  category: z.enum(["ASSET", "LIABILITY", "OTHER"]).optional(),
  balance: z.number(),
  currency: z.string().min(3).max(3),
  notes: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  deletedAt: z.string().datetime().nullable().optional(),
  // Credit account fields (stored in metadata but managed as form fields)
  creditLimit: z.number().optional(),
  billingCycleDay: z.number().min(1).max(31).optional(),
  // Asset account fields
  accountNumber: z.string().max(4).optional(),
});

export type Account = z.infer<typeof accountSchema>;
export type AccountFormData = z.infer<typeof accountSchema>;

export type AccountResponse = {
  id: string;
  name: string;
  notes?: string;
  currency: string;
  type: string;
  category: AccountCategory;
  balance: number;
  metadata: AccountMetadata | null;
  user_id: string;
  deleted_at: string | null;
  created_at: Date;
  updated_at: Date;
  version: number;
  // Computed fields for credit accounts
  available_credit?: number | null;
  credit_utilization?: number | null;
};

export type AccountsApiResponse = JsonApiResponse<AccountResponse[]>;
export type AccountsApiError = {
  errors: Array<{
    status?: string;
    code?: string;
    title?: string;
    detail?: string;
  }>;
};

export type PaginatedAccountsResult = {
  accounts: Account[];
  pagination?: PaginationInfo;
  aggregations: Record<string, AggregationItem[]>;
};

// Category aggregation result from backend
export type CategoryAggregationResult = {
  category: AccountCategory;
  count: number;
  totalBalance: number;
};
