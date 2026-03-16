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
  if (params?.startDate) {
    // Use local date string to avoid timezone offsets
    const year = params.startDate.getFullYear();
    const month = String(params.startDate.getMonth() + 1).padStart(2, "0");
    const day = String(params.startDate.getDate()).padStart(2, "0");
    const dateStr = `${year}-${month}-${day}`;
    searchParams.append("start_date", dateStr);
  }
  if (params?.endDate) {
    // Use local date string to avoid timezone offsets
    const year = params.endDate.getFullYear();
    const month = String(params.endDate.getMonth() + 1).padStart(2, "0");
    const day = String(params.endDate.getDate()).padStart(2, "0");
    const dateStr = `${year}-${month}-${day}`;
    searchParams.append("end_date", dateStr);
  }

  // Add dynamic filters - support comma-separated values for multi-select
  if (params?.filters) {
    for (const [key, values] of Object.entries(params.filters)) {
      if (values.length > 0) {
        // Map frontend filter keys to backend parameter names
        const paramName =
          key === "account"
            ? "account_id"
            : key === "category"
              ? "budget_item_id"
              : key; // type and currency use same name

        // Join multiple values with comma for multi-select support
        searchParams.append(paramName, values.join(","));
      }
    }
  }

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

export const transactionMutationOptions = () => {
  const queryClient = useQueryClient();

  return mutationOptions({
    mutationFn: mutateTransaction,
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
    },
  });
};

export const transactionDeleteMutationOptions = () => {
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
