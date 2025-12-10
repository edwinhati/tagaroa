import type { PaginationInfo } from "@repo/common/types";
import { z } from "zod";

export const budgetItemSchema = z.object({
  id: z.string().optional(),
  allocation: z.number(),
  category: z.string(),
  deletedAt: z.iso.datetime().nullable().optional(),
});

export const budgetSchema = z.object({
  id: z.string().optional(),
  month: z.number().min(1).max(12),
  year: z.number().min(2000).max(2099),
  amount: z.number().min(0),
  currency: z.string().min(3).max(3),
  items: z.array(budgetItemSchema).optional(),
  deletedAt: z.iso.datetime().nullable().optional(),
});

export type Budget = z.infer<typeof budgetSchema>;
export type BudgetItem = z.infer<typeof budgetItemSchema>;

export type BudgetItemResponse = {
  id: string;
  allocation: number;
  budget_id?: string;
  category: string;
  deleted_at: string | null;
  created_at: Date;
  updated_at: Date;
};

export type BudgetResponse = {
  id: string;
  month: number;
  year: number;
  amount: number;
  currency: string;
  items: BudgetItemResponse[] | null;
  deleted_at: string | null;
  created_at: Date;
  updated_at: Date;
};

export type BudgetsApiResponse = {
  timestamp: string;
  data: BudgetResponse[] | null;
  pagination: PaginationInfo;
  message: string;
};

export type PaginatedBudgetsResult = {
  budgets: Budget[];
  pagination: PaginationInfo;
};
