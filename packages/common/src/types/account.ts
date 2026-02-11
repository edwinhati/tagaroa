import type {
  AggregationItem,
  JsonApiResponse,
  PaginationInfo,
} from "@repo/common/types";
import { z } from "zod";

export const accountSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, "Name is required"),
  type: z.string(),
  balance: z.number(),
  currency: z.string().min(3).max(3),
  notes: z.string().optional(),
  deletedAt: z.string().datetime().nullable().optional(),
});

export type Account = z.infer<typeof accountSchema>;

export type AccountResponse = {
  id: string;
  name: string;
  notes?: string;
  currency: string;
  type: string;
  balance: number;
  deleted_at: string | null;
  created_at: Date;
  updated_at: Date;
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
  pagination: PaginationInfo;
  aggregations: Record<string, AggregationItem[]>;
};
