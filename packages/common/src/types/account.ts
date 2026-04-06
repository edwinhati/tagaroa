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
// Helper to get utilization color
// Calculate credit utilization
// Calculate available credit
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
export type PaginatedAccountsResult = {
  accounts: Account[];
  pagination?: PaginationInfo;
  aggregations: Record<string, AggregationItem[]>;
};
