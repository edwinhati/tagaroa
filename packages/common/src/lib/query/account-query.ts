"use client";

import { financeApi } from "@repo/common/lib/http";
import type {
  Account,
  AccountResponse,
  AccountsApiResponse,
  PaginatedAccountsResult,
} from "@repo/common/types/account";
import {
  mutationOptions,
  queryOptions,
  useQueryClient,
} from "@tanstack/react-query";

const mapAccount = (account: AccountResponse): Account => ({
  id:
    account.id !== undefined && account.id !== null && account.id.trim() !== ""
      ? String(account.id)
      : undefined,
  name: account.name,
  notes: account.notes,
  type: account.type,
  balance: account.balance,
  currency: account.currency,
  deletedAt: account.deleted_at ?? null,
});

// Fetch all accounts with pagination
const fetchAccounts = async (params?: {
  page?: number;
  limit?: number;
  filters?: Record<string, string[]>;
  search?: string;
}): Promise<PaginatedAccountsResult> => {
  const searchParams = new URLSearchParams();

  if (params?.page) searchParams.append("page", params.page.toString());
  if (params?.limit) searchParams.append("limit", params.limit.toString());
  if (params?.search) searchParams.append("search", params.search);

  // Add dynamic filters - support comma-separated values for multi-select
  if (params?.filters) {
    for (const [key, values] of Object.entries(params.filters)) {
      if (values.length > 0) {
        // Join multiple values with comma for multi-select support
        searchParams.append(key, values.join(","));
      }
    }
  }

  const queryString = searchParams.toString();
  const url = queryString ? `/accounts?${queryString}` : "/accounts";

  try {
    const data = await financeApi.get<AccountsApiResponse>(url, {
      unwrapData: false,
    });

    return {
      accounts: data.data ? data.data.map(mapAccount) : [],
      pagination: data.meta?.pagination,
      aggregations: data.meta?.aggregations || {},
    };
  } catch (error) {
    console.error("Error fetching accounts:", error);
    throw error;
  }
};

// Fetch account types
const fetchAccountTypes = async (): Promise<string[]> => {
  return financeApi.get<string[]>("/accounts/types");
};

// Create or update an account
const mutateAccount = async (account: Account): Promise<Account> => {
  // Map frontend Account (camelCase) to backend payload (snake_case)
  const payload = {
    id: account.id,
    name: account.name,
    type: account.type,
    balance: account.balance,
    currency: account.currency,
    notes: account.notes ?? "",
    deleted_at: account.deletedAt ?? null,
  };

  // Check if account.id exists and is not empty string
  const hasValidId = account.id && account.id.trim() !== "";

  const data = await (hasValidId
    ? financeApi.patch<AccountResponse>(`/accounts/${account.id}`, payload)
    : financeApi.post<AccountResponse>("/accounts", payload));

  return mapAccount(data);
};

// Delete an account
const deleteAccount = async (id: string): Promise<void> => {
  await financeApi.delete(`/accounts/${id}`);
};

// Fetch all accounts for export (with large limit)
const fetchExportAccounts = async (params?: {
  filters?: Record<string, string[]>;
  search?: string;
}): Promise<Account[]> => {
  const result = await fetchAccounts({
    ...params,
    limit: 10000,
    page: 1,
  });
  return result.accounts;
};

export const accountQueryOptions = (params?: {
  page?: number;
  limit?: number;
  filters?: Record<string, string[]>;
  search?: string;
}) => {
  return queryOptions({
    queryKey: ["accounts", params],
    queryFn: () => fetchAccounts(params),
  });
};

export const accountMutationOptions = () => {
  const queryClient = useQueryClient();

  return mutationOptions({
    mutationFn: mutateAccount,
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
    },
  });
};

export const accountDeleteMutationOptions = () => {
  const queryClient = useQueryClient();

  return mutationOptions({
    mutationFn: deleteAccount,
    onMutate: async (deletedId: string) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["accounts"] });

      // Snapshot the previous value
      const previousAccounts = queryClient.getQueryData(["accounts"]);

      // Optimistically update to the new value
      queryClient.setQueryData(
        ["accounts"],
        (old: PaginatedAccountsResult | undefined) => {
          if (!old) return old;

          return {
            ...old,
            accounts: old.accounts.filter(
              (account) => account.id !== deletedId,
            ),
          };
        },
      );

      // Return a context object with the snapshotted value
      return { previousAccounts };
    },
    onError: (_err, _deletedId, context) => {
      // If the mutation fails, use the context returned from onMutate to roll back
      if (context?.previousAccounts) {
        queryClient.setQueryData(["accounts"], context.previousAccounts);
      }
    },
    onSettled: () => {
      // Refetch after success or error
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
    },
  });
};

export const accountTypesQueryOptions = () => {
  return queryOptions({
    queryKey: ["account-types"],
    queryFn: fetchAccountTypes,
  });
};

export const exportAccountsQueryOptions = (params?: {
  filters?: Record<string, string[]>;
  search?: string;
}) => {
  return queryOptions({
    queryKey: ["accounts-export", params],
    queryFn: () => fetchExportAccounts(params),
  });
};
