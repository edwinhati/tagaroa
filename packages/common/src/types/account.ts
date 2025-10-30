import { z } from "zod";

export const accountSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, "Name is required"),
  type: z.string(),
  balance: z.number(),
  currency: z.string(),
  notes: z.string().optional(),
  isDeleted: z.boolean().optional(),
});

export type Account = z.infer<typeof accountSchema>;

export type AccountResponse = {
  id: string;
  name: string;
  notes?: string;
  currency: string;
  type: string;
  balance: number;
  is_deleted: boolean;
  created_at: Date;
  updated_at: Date;
};

export type PaginationInfo = {
  page: number;
  limit: number;
  offset: number;
  total: number;
  total_pages: number;
  has_next: boolean;
  has_prev: boolean;
};

export type AggregationItem = {
  key: string;
  count: number;
  min: number;
  max: number;
  avg: number;
  sum: number;
};

export type AccountsApiResponse = {
  timestamp: string;
  data: AccountResponse[] | null;
  pagination: PaginationInfo;
  aggregations: Record<string, AggregationItem[]>;
  message: string;
};

export type PaginatedAccountsResult = {
  accounts: Account[];
  pagination: PaginationInfo;
  aggregations: Record<string, AggregationItem[]>;
};
