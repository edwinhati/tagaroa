import type { AggregationItem, JsonApiResponse, PaginationInfo } from "@repo/common/types";
import { z } from "zod";

export const assetSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, "Name is required"),
  type: z.string(),
  value: z.number(),
  shares: z.number().optional().nullable(),
  ticker: z.string().optional().nullable(),
  currency: z.string().min(3).max(3),
  notes: z.string().optional(),
  deletedAt: z.string().datetime().nullable().optional(),
});

export type Asset = z.infer<typeof assetSchema>;

export type AssetResponse = {
  id: string;
  name: string;
  type: string;
  value: number;
  shares?: number | null;
  ticker?: string | null;
  currency: string;
  notes?: string;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
};

export type AssetsApiResponse = JsonApiResponse<AssetResponse[]>;
export type AssetsApiError = {
  errors: Array<{
    status?: string;
    code?: string;
    title?: string;
    detail?: string;
  }>;
};

export type PaginatedAssetsResult = {
  assets: Asset[];
  pagination: PaginationInfo;
  aggregations?: Record<string, AggregationItem[]>;
};
