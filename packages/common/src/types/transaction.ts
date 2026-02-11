import type { AggregationItem, JsonApiResponse, PaginationInfo } from "@repo/common/types";
import { z } from "zod";

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
export type TransactionsApiError = {
  errors: Array<{
    status?: string;
    code?: string;
    title?: string;
    detail?: string;
  }>;
};

export type PaginatedTransactionsResult = {
  transactions: Transaction[];
  pagination: PaginationInfo;
  aggregations: Record<string, AggregationItem[]>;
};
