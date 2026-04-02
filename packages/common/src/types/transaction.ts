import type {
  AggregationItem,
  JsonApiResponse,
  PaginationInfo,
} from "@repo/common/types";
import { z } from "zod";

// Installment schema
export const installmentSchema = z.object({
  tenure: z.number().min(1).max(60),
  interestRate: z.number().min(0).max(100),
  monthlyAmount: z.number().min(0),
  liabilityId: z.string().optional(),
});

export type Installment = z.infer<typeof installmentSchema>;

export const transactionSchema = z.object({
  id: z.string().optional(),
  amount: z.number().min(0.01, "Amount must be greater than 0"),
  date: z.date(),
  type: z.enum(["INCOME", "EXPENSE"]),
  currency: z.string().min(3).max(3),
  notes: z.string().optional(),
  files: z.array(z.string()).optional(),
  account_id: z.string().min(1, "Account is required"),
  budget_item_id: z.string().optional(),
  deletedAt: z.string().datetime().nullable().optional(),
  installment: installmentSchema.optional(),
  account: z
    .object({
      id: z.string(),
      name: z.string(),
      type: z.string(),
      balance: z.number(),
      currency: z.string(),
    })
    .optional(),
  budget_item: z
    .object({
      id: z.string(),
      allocation: z.number(),
      category: z.string(),
    })
    .optional(),
});

export type Transaction = z.infer<typeof transactionSchema>;

export type TransactionResponse = {
  id: string;
  amount: number;
  date: string;
  type: string;
  currency: string;
  notes?: string;
  files?: string[];
  user_id: string;
  account_id: string;
  budget_item_id?: string;
  deleted_at: string | null;
  created_at: Date;
  updated_at: Date;
  version: number;
  installment?: Installment;
  account?: {
    id: string;
    name: string;
    type: string;
    balance: number;
    currency: string;
  };
  budget_item?: {
    id: string;
    allocation: number;
    category: string;
  };
};

export type TransactionsApiResponse = JsonApiResponse<TransactionResponse[]>;
export type PaginatedTransactionsResult = {
  transactions: Transaction[];
  pagination?: PaginationInfo;
  aggregations: Record<string, AggregationItem[]>;
};

// Helper function to calculate monthly installment amount
export function calculateMonthlyInstallment(
  principal: number,
  annualInterestRate: number,
  tenureMonths: number,
): number {
  if (annualInterestRate === 0) {
    return principal / tenureMonths;
  }

  const monthlyRate = annualInterestRate / 100 / 12;
  const factor = (1 + monthlyRate) ** tenureMonths;
  const emi = (principal * monthlyRate * factor) / (factor - 1);

  return Math.round(emi * 100) / 100;
}

// Helper to calculate total interest
// Helper to format installment breakdown
export function formatInstallmentBreakdown(
  principal: number,
  annualInterestRate: number,
  tenureMonths: number,
  currency: string,
): {
  principal: number;
  interest: number;
  total: number;
  monthlyAmount: number;
  formatted: {
    principal: string;
    interest: string;
    total: string;
    monthlyAmount: string;
  };
} {
  const monthlyAmount = calculateMonthlyInstallment(
    principal,
    annualInterestRate,
    tenureMonths,
  );
  const total = monthlyAmount * tenureMonths;
  const interest = total - principal;

  const formatter = new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });

  return {
    principal,
    interest: Math.round(interest * 100) / 100,
    total: Math.round(total * 100) / 100,
    monthlyAmount,
    formatted: {
      principal: formatter.format(principal),
      interest: formatter.format(interest),
      total: formatter.format(total),
      monthlyAmount: formatter.format(monthlyAmount),
    },
  };
}
