"use client";

import { financeApi } from "@repo/common/lib/http";
import type {
  Asset,
  AssetResponse,
  AssetsApiResponse,
  PaginatedAssetsResult,
} from "@repo/common/types/asset";
import {
  mutationOptions,
  queryOptions,
  useQueryClient,
} from "@tanstack/react-query";

const mapAsset = (asset: AssetResponse): Asset => ({
  id: asset.id,
  name: asset.name,
  type: asset.type,
  value: asset.value,
  shares: asset.shares,
  ticker: asset.ticker,
  currency: asset.currency,
  notes: asset.notes,
  deletedAt: asset.deleted_at ?? null,
});

const fetchAssets = async (params?: {
  page?: number;
  limit?: number;
  filters?: Record<string, string[]>;
  search?: string;
}): Promise<PaginatedAssetsResult> => {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.append("page", params.page.toString());
  if (params?.limit) searchParams.append("limit", params.limit.toString());
  if (params?.search) searchParams.append("search", params.search);
  if (params?.filters) {
    for (const [key, values] of Object.entries(params.filters)) {
      if (values.length > 0) searchParams.append(key, values.join(","));
    }
  }

  const url = searchParams.toString() ? `/assets?${searchParams}` : "/assets";
  const data = await financeApi.get<AssetsApiResponse>(url, {
    unwrapData: false,
  });

  return {
    assets: data.data ? data.data.map(mapAsset) : [],
    pagination: data.pagination,
    aggregations: data.aggregations || {},
  };
};

const fetchAssetTypes = async (): Promise<string[]> => {
  return financeApi.get<string[]>("/asset/types");
};

const mutateAsset = async (asset: Asset): Promise<Asset> => {
  const payload = {
    name: asset.name,
    type: asset.type,
    value: asset.value,
    shares: asset.shares,
    ticker: asset.ticker,
    currency: asset.currency,
    notes: asset.notes ?? "",
  };

  const data = await (asset.id
    ? financeApi.put<AssetResponse>(`/asset/${asset.id}`, payload)
    : financeApi.post<AssetResponse>("/asset", payload));

  return mapAsset(data);
};

const deleteAsset = async (id: string): Promise<void> => {
  await financeApi.delete(`/asset/${id}`);
};

export const assetQueryOptions = (params?: {
  page?: number;
  limit?: number;
  filters?: Record<string, string[]>;
  search?: string;
}) =>
  queryOptions({
    queryKey: ["assets", params],
    queryFn: () => fetchAssets(params),
  });

export const assetMutationOptions = () => {
  const queryClient = useQueryClient();
  return mutationOptions({
    mutationFn: mutateAsset,
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["assets"] }),
  });
};

export const assetDeleteMutationOptions = () => {
  const queryClient = useQueryClient();
  return mutationOptions({
    mutationFn: deleteAsset,
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["assets"] }),
  });
};

export const assetTypesQueryOptions = () =>
  queryOptions({
    queryKey: ["asset-types"],
    queryFn: fetchAssetTypes,
  });
