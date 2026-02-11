"use client";

import { financeApi } from "@repo/common/lib/http";
import type { AggregationItem } from "@repo/common/types";
import type {
  LiabilitiesApiResponse,
  Liability,
  LiabilityResponse,
  PaginatedLiabilitiesResult,
} from "@repo/common/types/liability";
import {
  mutationOptions,
  queryOptions,
  useQueryClient,
} from "@tanstack/react-query";

const mapLiability = (liability: LiabilityResponse): Liability => ({
  id: liability.id,
  name: liability.name,
  type: liability.type,
  amount: liability.amount,
  currency: liability.currency,
  paidAt: liability.paid_at ?? null,
  notes: liability.notes,
  deletedAt: liability.deleted_at ?? null,
});

const fetchLiabilities = async (params?: {
  page?: number;
  limit?: number;
  filters?: Record<string, string[]>;
  search?: string;
}): Promise<PaginatedLiabilitiesResult> => {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.append("page", params.page.toString());
  if (params?.limit) searchParams.append("limit", params.limit.toString());
  if (params?.search) searchParams.append("search", params.search);
  if (params?.filters) {
    for (const [key, values] of Object.entries(params.filters)) {
      if (values.length > 0) searchParams.append(key, values.join(","));
    }
  }

  const url = searchParams.toString()
    ? `/liabilities?${searchParams}`
    : "/liabilities";
  const data = await financeApi.get<LiabilitiesApiResponse>(url, {
    unwrapData: false,
  });

  return {
    liabilities: data.data ? data.data.map(mapLiability) : [],
    pagination: data.pagination,
    aggregations:
      (data as { aggregations?: Record<string, AggregationItem[]> })
        .aggregations ?? {},
  };
};

const fetchLiabilityTypes = async (): Promise<string[]> => {
  return financeApi.get<string[]>("/liability/types");
};

const mutateLiability = async (liability: Liability): Promise<Liability> => {
  const payload = {
    name: liability.name,
    type: liability.type,
    amount: liability.amount,
    currency: liability.currency,
    paid_at: liability.paidAt,
    notes: liability.notes ?? "",
  };

  const data = await (liability.id
    ? financeApi.put<LiabilityResponse>(`/liability/${liability.id}`, payload)
    : financeApi.post<LiabilityResponse>("/liability", payload));

  return mapLiability(data);
};

const deleteLiability = async (id: string): Promise<void> => {
  await financeApi.delete(`/liability/${id}`);
};

// Fetch all liabilities for export (with large limit)
const fetchExportLiabilities = async (params?: {
  filters?: Record<string, string[]>;
  search?: string;
}): Promise<Liability[]> => {
  const result = await fetchLiabilities({
    ...params,
    limit: 10000,
    page: 1,
  });
  return result.liabilities;
};

export const liabilityQueryOptions = (params?: {
  page?: number;
  limit?: number;
  filters?: Record<string, string[]>;
  search?: string;
}) =>
  queryOptions({
    queryKey: ["liabilities", params],
    queryFn: () => fetchLiabilities(params),
  });

export const liabilityMutationOptions = () => {
  const queryClient = useQueryClient();
  return mutationOptions({
    mutationFn: mutateLiability,
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: ["liabilities"] }),
  });
};

export const liabilityDeleteMutationOptions = () => {
  const queryClient = useQueryClient();

  return mutationOptions({
    mutationFn: deleteLiability,
    onMutate: async (id) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["liabilities"] });

      // Snapshot previous value
      const previous = queryClient.getQueryData(["liabilities"]);

      // Optimistically update to the new value
      queryClient.setQueryData(["liabilities"], (old: any) => {
        if (!old) return old;
        return {
          ...old,
          liabilities: old.liabilities.filter((l: Liability) => l.id !== id),
        };
      });

      // Return context with previous value
      return { previous };
    },
    onError: (err, id, context) => {
      // Rollback to previous value
      if (context?.previous) {
        queryClient.setQueryData(["liabilities"], context.previous);
      }
    },
    onSettled: () => {
      // Refetch after success or error
      queryClient.invalidateQueries({ queryKey: ["liabilities"] });
    },
  });
};

export const liabilityTypesQueryOptions = () =>
  queryOptions({
    queryKey: ["liability-types"],
    queryFn: fetchLiabilityTypes,
  });

export const exportLiabilitiesQueryOptions = (params?: {
  filters?: Record<string, string[]>;
  search?: string;
}) =>
  queryOptions({
    queryKey: ["liabilities-export", params],
    queryFn: () => fetchExportLiabilities(params),
  });

export const exportLiabilities = (params?: {
  filters?: Record<string, string[]>;
  search?: string;
}) => {
  return fetchExportLiabilities(params);
};
