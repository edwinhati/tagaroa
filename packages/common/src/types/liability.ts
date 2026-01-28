import type { AggregationItem, PaginationInfo } from "@repo/common/types";
import { z } from "zod";

export const liabilitySchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, "Name is required"),
  type: z.string(),
  amount: z.number(),
  currency: z.string().min(3).max(3),
  paidAt: z.string().datetime().nullable().optional(),
  notes: z.string().optional(),
  deletedAt: z.string().datetime().nullable().optional(),
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
};

export type LiabilitiesApiResponse = {
  timestamp: string;
  data: LiabilityResponse[] | null;
  pagination: PaginationInfo;
  message: string;
};

export type PaginatedLiabilitiesResult = {
  liabilities: Liability[];
  pagination: PaginationInfo;
  aggregations?: Record<string, AggregationItem[]>;
};
