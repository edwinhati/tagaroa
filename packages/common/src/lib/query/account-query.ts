"use client";

import {
  useQuery,
  useMutation,
  useQueryClient,
  UseQueryOptions,
  UseMutationOptions,
} from "@tanstack/react-query";
import { financeApi } from "@repo/common/lib/http";
import { authClient } from "@repo/common/lib/auth-client";
import {
  Account,
  AccountResponse,
  AccountsApiResponse,
  PaginatedAccountsResult,
} from "@repo/common/types/account";

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
  isDeleted: account.is_deleted,
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
    Object.entries(params.filters).forEach(([key, values]) => {
      if (values.length > 0) {
        // Join multiple values with comma for multi-select support
        searchParams.append(key, values.join(","));
      }
    });
  }

  const queryString = searchParams.toString();
  const url = `/account${queryString ? `?${queryString}` : ""}`;

  try {
    // Use custom fetch to bypass envelope extraction completely
    const baseUrl = process.env.NEXT_PUBLIC_API_URL as string;
    const fullUrl = `${baseUrl}/api/finance${url}`;

    // Get auth token
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    try {
      const { data: jwtData } = await authClient.token();
      if (jwtData?.token) {
        headers["Authorization"] = `Bearer ${jwtData.token}`;
      }
    } catch (error) {
      console.warn("Could not get auth token:", error);
    }

    const response = await fetch(fullUrl, {
      method: "GET",
      headers,
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = (await response.json()) as AccountsApiResponse;

    return {
      accounts: data.data ? data.data.map(mapAccount) : [],
      pagination: data.pagination,
      aggregations: data.aggregations || {},
    };
  } catch (error) {
    console.error("Error fetching accounts:", error);
    throw error;
  }
};

// Fetch account types
const fetchAccountTypes = async (): Promise<string[]> => {
  return financeApi.get<string[]>("/account/types");
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
    is_deleted: account.isDeleted ?? false,
  };

  // Check if account.id exists and is not empty string
  const hasValidId = account.id && account.id.trim() !== "";

  const data = await (hasValidId
    ? financeApi.put<AccountResponse>(`/account/${account.id}`, payload)
    : financeApi.post<AccountResponse>("/account", payload));

  return mapAccount(data);
};

// Hook: Fetch accounts with pagination
export const useGetAccounts = (
  params?: {
    page?: number;
    limit?: number;
    filters?: Record<string, string[]>;
    search?: string;
  },
  options?: UseQueryOptions<
    PaginatedAccountsResult,
    Error,
    PaginatedAccountsResult,
    any
  >,
) => {
  return useQuery({
    queryKey: ["accounts", params],
    queryFn: () => fetchAccounts(params),
    ...options,
  });
};

// Hook: Fetch account types
export const useGetAccountTypes = (
  options?: UseQueryOptions<string[], Error, string[], any>,
) => {
  return useQuery({
    queryKey: ["accountTypes"],
    queryFn: fetchAccountTypes,
    ...options,
  });
};

// Hook: Create or update an account
export const useMutateAccount = (
  options?: UseMutationOptions<
    Account,
    Error,
    Account,
    { previousAccounts?: Account[] }
  >,
) => {
  const queryClient = useQueryClient();

  return useMutation<Account, Error, Account, { previousAccounts?: Account[] }>(
    {
      mutationKey: ["mutateAccount"],
      mutationFn: mutateAccount,
      onSettled: () => {
        queryClient.invalidateQueries({ queryKey: ["accounts"] });
        queryClient.invalidateQueries({ queryKey: ["accounts-legacy"] });
      },
      ...options,
    },
  );
};
