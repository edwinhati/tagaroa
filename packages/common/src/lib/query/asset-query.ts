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
    pagination: data.meta?.pagination,
    aggregations: data.meta?.aggregations || {},
  };
};

const fetchAssetTypes = async (): Promise<string[]> => {
  return financeApi.get<string[]>("/assets/types");
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
    ? financeApi.patch<AssetResponse>(`/assets/${asset.id}`, payload)
    : financeApi.post<AssetResponse>("/assets", payload));

  return mapAsset(data);
};

const deleteAsset = async (id: string): Promise<void> => {
  await financeApi.delete(`/assets/${id}`);
};

// Fetch all assets for export (with large limit)
const fetchExportAssets = async (params?: {
  filters?: Record<string, string[]>;
  search?: string;
}): Promise<Asset[]> => {
  const result = await fetchAssets({
    ...params,
    limit: 10000,
    page: 1,
  });
  return result.assets;
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

export const useAssetMutationOptions = () => {
  const queryClient = useQueryClient();
  return mutationOptions({
    mutationFn: mutateAsset,
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["assets"] }),
  });
};

export const useAssetDeleteMutationOptions = () => {
  const queryClient = useQueryClient();

  return mutationOptions({
    mutationFn: deleteAsset,
    onMutate: async (id) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["assets"] });

      // Snapshot previous value
      const previous = queryClient.getQueryData(["assets"]);

      // Optimistically update to the new value
      queryClient.setQueryData(
        ["assets"],
        (old: { assets: Asset[] } | undefined) => {
          if (!old) return old;
          return {
            ...old,
            assets: old.assets.filter((asset: Asset) => asset.id !== id),
          };
        },
      );

      // Return context with previous value
      return { previous };
    },
    onError: (_err, _id, context) => {
      // Rollback to previous value
      if (context?.previous) {
        queryClient.setQueryData(["assets"], context.previous);
      }
    },
    onSettled: () => {
      // Refetch after success or error
      queryClient.invalidateQueries({ queryKey: ["assets"] });
    },
  });
};

export const assetTypesQueryOptions = () =>
  queryOptions({
    queryKey: ["asset-types"],
    queryFn: fetchAssetTypes,
  });

export const exportAssetsQueryOptions = (params?: {
  filters?: Record<string, string[]>;
  search?: string;
}) => {
  return queryOptions({
    queryKey: ["assets-export", params],
    queryFn: () => fetchExportAssets(params),
  });
};
