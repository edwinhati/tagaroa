import type {
  AggregationItem,
  JsonApiResponse,
  PaginationInfo,
} from "@repo/common/types";
import { z } from "zod";

// Installment metadata for liabilities created from transactions
export const installmentMetadataSchema = z.object({
  tenure: z.number(),
  interestRate: z.number(),
  monthlyAmount: z.number(),
});

export type InstallmentMetadata = z.infer<typeof installmentMetadataSchema>;

export const liabilitySchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, "Name is required"),
  type: z.string(),
  amount: z.number(),
  currency: z.string().min(3).max(3),
  paidAt: z.iso.datetime().nullable().optional(),
  notes: z.string().optional(),
  deletedAt: z.iso.datetime().nullable().optional(),
  // Installment-related fields
  transactionId: z.string().optional(),
  installmentNumber: z.number().optional(),
  originalAmount: z.number().optional(),
  totalInterest: z.number().optional(),
  totalAmount: z.number().optional(),
  remainingMonths: z.number().optional(),
  installmentMetadata: installmentMetadataSchema.optional(),
});

export type Liability = z.infer<typeof liabilitySchema>;

export type LiabilityResponse = {
  id: string;
  name: string;
  type: string;
  amount: number;
  currency: string;
  paid_at?: string | null;
  notes?: string;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
  // Installment-related fields
  transaction_id?: string;
  installment_number?: number;
  original_amount?: number;
  total_interest?: number;
  total_amount?: number;
  remaining_months?: number;
  installment_metadata?: InstallmentMetadata;
};

export type LiabilitiesApiResponse = JsonApiResponse<LiabilityResponse[]>;
export type PaginatedLiabilitiesResult = {
  liabilities: Liability[];
  pagination?: PaginationInfo;
  aggregations?: Record<string, AggregationItem[]>;
};

// Helper to check if liability is an installment
// Helper to get installment progress
export function getInstallmentProgress(
  liability: Liability | LiabilityResponse,
): { paid: number; total: number; percentage: number } | null {
  // Get metadata from either camelCase or snake_case property
  const metadata =
    ("installmentMetadata" in liability && liability.installmentMetadata) ||
    ("installment_metadata" in liability && liability.installment_metadata);

  // Get remaining months from either camelCase or snake_case property
  let remainingMonths: number | undefined;
  if ("remainingMonths" in liability) {
    remainingMonths = liability.remainingMonths;
  } else if ("remaining_months" in liability) {
    remainingMonths = liability.remaining_months;
  }

  if (!metadata || remainingMonths === undefined) {
    return null;
  }

  const total = metadata.tenure;
  const paid = total - remainingMonths;
  const percentage = Math.round((paid / total) * 100);

  return { paid, total, percentage };
}
