"use client";

import { financeApi } from "@repo/common/lib/http";
import type {
  PaginatedTransactionsResult,
  Transaction,
  TransactionResponse,
  TransactionsApiResponse,
} from "@repo/common/types/transaction";
import {
  mutationOptions,
  queryOptions,
  useQueryClient,
} from "@tanstack/react-query";

const mapTransaction = (transaction: TransactionResponse): Transaction => ({
  id:
    transaction.id !== undefined &&
    transaction.id !== null &&
    transaction.id.trim() !== ""
      ? String(transaction.id)
      : undefined,
  amount: transaction.amount,
  date: new Date(transaction.date),
  type: transaction.type as "INCOME" | "EXPENSE",
  currency: transaction.currency,
  notes: transaction.notes,
  files: transaction.files ?? [],
  account_id: transaction.account_id,
  budget_item_id: transaction.budget_item_id,
  deletedAt: transaction.deleted_at ?? null,
  account: transaction.account,
  budget_item: transaction.budget_item,
  installment: transaction.installment
    ? {
        tenure: transaction.installment.tenure,
        interestRate: transaction.installment.interestRate,
        monthlyAmount: transaction.installment.monthlyAmount,
        liabilityId: transaction.installment.liabilityId,
      }
    : undefined,
});

const formatDateForApi = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const getFilterParamName = (key: string): string => {
  if (key === "account") return "account_id";
  if (key === "category") return "budget_item_id";
  return key; // type and currency use same name
};

const applyFilters = (
  searchParams: URLSearchParams,
  filters?: Record<string, string[]>,
) => {
  if (!filters) return;
  for (const [key, values] of Object.entries(filters)) {
    if (values.length > 0) {
      // Join multiple values with comma for multi-select support
      searchParams.append(getFilterParamName(key), values.join(","));
    }
  }
};

// Fetch all transactions with pagination
const fetchTransactions = async (params?: {
  page?: number;
  limit?: number;
  filters?: Record<string, string[]>;
  search?: string;
  startDate?: Date;
  endDate?: Date;
}): Promise<PaginatedTransactionsResult> => {
  const searchParams = new URLSearchParams();

  if (params?.page) searchParams.append("page", params.page.toString());
  if (params?.limit) searchParams.append("limit", params.limit.toString());
  if (params?.search) searchParams.append("search", params.search);

  // Add date range filters
  // Use local date string to avoid timezone offsets
  if (params?.startDate) {
    searchParams.append("start_date", formatDateForApi(params.startDate));
  }
  if (params?.endDate) {
    searchParams.append("end_date", formatDateForApi(params.endDate));
  }

  // Add dynamic filters - support comma-separated values for multi-select
  applyFilters(searchParams, params?.filters);

  const queryString = searchParams.toString();
  const url = queryString ? `/transactions?${queryString}` : "/transactions";

  try {
    const data = await financeApi.get<TransactionsApiResponse>(url, {
      unwrapData: false,
    });

    return {
      transactions: data.data ? data.data.map(mapTransaction) : [],
      pagination: data.meta?.pagination,
      aggregations: data.meta?.aggregations || {},
    };
  } catch (error) {
    console.error("Error fetching transactions:", error);
    throw error;
  }
};

// Fetch transaction types
const fetchTransactionTypes = async (): Promise<string[]> => {
  return financeApi.get<string[]>("/transactions/types");
};

// Create or update a transaction
const mutateTransaction = async (
  transaction: Transaction,
): Promise<Transaction> => {
  // Check if transaction.id exists and is not empty string
  const hasValidId = transaction.id && transaction.id.trim() !== "";

  if (hasValidId) {
    // Update payload - only include fields that can be updated
    const updatePayload = {
      amount: transaction.amount,
      date: transaction.date.toISOString(),
      type: transaction.type,
      currency: transaction.currency,
      notes: transaction.notes ?? "",
      files: transaction.files ?? [],
      account_id: transaction.account_id,
      budget_item_id: transaction.budget_item_id,
    };

    const data = await financeApi.patch<TransactionResponse>(
      `/transactions/${transaction.id}`,
      updatePayload,
    );
    return mapTransaction(data);
  } else {
    // Create payload - include all fields
    const createPayload: Record<string, unknown> = {
      amount: transaction.amount,
      date: transaction.date.toISOString(),
      type: transaction.type,
      currency: transaction.currency,
      notes: transaction.notes ?? "",
      files: transaction.files ?? [],
      account_id: transaction.account_id,
      budget_item_id: transaction.budget_item_id,
      deleted_at: transaction.deletedAt ?? null,
    };

    if (transaction.installment) {
      const installmentPayload = {
        tenure: transaction.installment.tenure,
        interest_rate:
          (transaction.installment as unknown as Record<string, number>)
            .interest_rate ?? transaction.installment.interestRate,
        monthly_amount:
          (transaction.installment as unknown as Record<string, number>)
            .monthly_amount ?? transaction.installment.monthlyAmount,
      };

      createPayload.installment = installmentPayload;
    }

    const data = await financeApi.post<TransactionResponse>(
      "/transactions",
      createPayload,
    );
    return mapTransaction(data);
  }
};

// Delete a transaction
const deleteTransaction = async (id: string): Promise<void> => {
  await financeApi.delete(`/transactions/${id}`);
};

export const transactionQueryOptions = (params?: {
  page?: number;
  limit?: number;
  filters?: Record<string, string[]>;
  search?: string;
  startDate?: Date;
  endDate?: Date;
}) => {
  return queryOptions({
    queryKey: ["transactions", params],
    queryFn: () => fetchTransactions(params),
  });
};

export const useTransactionMutationOptions = () => {
  const queryClient = useQueryClient();

  return mutationOptions({
    mutationFn: mutateTransaction,
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
    },
  });
};

export const useTransactionDeleteMutationOptions = () => {
  const queryClient = useQueryClient();

  return mutationOptions({
    mutationFn: deleteTransaction,
    onMutate: async (id) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["transactions"] });

      // Snapshot previous value
      const previous = queryClient.getQueryData(["transactions"]);

      // Optimistically update to the new value
      queryClient.setQueryData(
        ["transactions"],
        (old: { transactions: Transaction[] } | undefined) => {
          if (!old) return old;
          return {
            ...old,
            transactions: old.transactions.filter(
              (t: Transaction) => t.id !== id,
            ),
          };
        },
      );

      // Return context with previous value
      return { previous };
    },
    onError: (_err, _id, context) => {
      // Rollback to previous value
      if (context?.previous) {
        queryClient.setQueryData(["transactions"], context.previous);
      }
    },
    onSettled: () => {
      // Refetch after success or error
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
    },
  });
};

export const transactionTypesQueryOptions = () => {
  return queryOptions({
    queryKey: ["transaction-types"],
    queryFn: fetchTransactionTypes,
  });
};
