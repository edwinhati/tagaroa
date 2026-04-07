"use client";

import { financeApi } from "@repo/common/lib/http";
import type {
  Budget,
  BudgetItem,
  BudgetItemResponse,
  BudgetResponse,
  BudgetsApiResponse,
  PaginatedBudgetsResult,
} from "@repo/common/types/budget";
import {
  mutationOptions,
  queryOptions,
  useQueryClient,
} from "@tanstack/react-query";

const mapBudgetItem = (item: BudgetItemResponse): BudgetItem => ({
  id:
    item.id !== undefined && item.id !== null && item.id.trim() !== ""
      ? String(item.id)
      : undefined,
  allocation: item.allocation,
  spent: item.spent ?? 0,
  category: item.category,
  deletedAt: item.deleted_at ?? null,
});

const mapBudget = (budget: BudgetResponse): Budget => ({
  id:
    budget.id !== undefined && budget.id !== null && budget.id.trim() !== ""
      ? String(budget.id)
      : undefined,
  month: budget.month,
  year: budget.year,
  amount: budget.amount,
  currency: budget.currency,
  items: budget.items ? budget.items.map(mapBudgetItem) : undefined,
  deletedAt: budget.deleted_at ?? null,
});

// Fetch specific budget by month and year
const fetchBudget = async (
  month: number,
  year: number,
): Promise<Budget | null> => {
  type BudgetEnvelope = {
    data?: BudgetResponse | null;
    meta?: {
      message?: string;
    };
  };

  try {
    // The finance API wraps responses; when a budget is not found, the payload
    // is `message: "Budget not found"` without a data field. Avoid mapping
    // that shape to a Budget and instead return null so the UI can show an
    // empty state rather than freezing on invalid dates.
    const response = await financeApi.get<BudgetEnvelope>(
      `/budgets/${month}/${year}`,
      { unwrapData: false },
    );

    const budget = response?.data ?? null;
    if (!budget) return null;

    return mapBudget(budget);
  } catch (error) {
    console.error("Error fetching budget:", error);
    return null;
  }
};

// Fetch all budgets with pagination
const fetchBudgets = async (params?: {
  page?: number;
  limit?: number;
}): Promise<PaginatedBudgetsResult> => {
  const searchParams = new URLSearchParams();

  if (params?.page) searchParams.append("page", params.page.toString());
  if (params?.limit) searchParams.append("limit", params.limit.toString());

  const queryString = searchParams.toString();
  const url = queryString ? `/budgets?${queryString}` : "/budgets";

  try {
    const data = await financeApi.get<BudgetsApiResponse>(url, {
      unwrapData: false,
    });

    return {
      budgets: data.data ? data.data.map(mapBudget) : [],
      pagination: data.meta?.pagination,
    };
  } catch (error) {
    console.error("Error fetching budgets:", error);
    throw error;
  }
};

// Create or update budget
const mutateBudget = async (budget: Budget): Promise<Budget> => {
  const payload = {
    id: budget.id,
    month: budget.month,
    year: budget.year,
    amount: budget.amount,
    currency: budget.currency,
  };

  // Check if budget.id exists and is not empty string
  const hasValidId = budget.id && budget.id.trim() !== "";

  const data = await (hasValidId
    ? financeApi.patch<BudgetResponse>(`/budgets/${budget.id}`, payload)
    : financeApi.post<BudgetResponse>("/budgets", payload));

  return mapBudget(data);
};

export const budgetQueryOptions = (params: { month: number; year: number }) => {
  return queryOptions({
    queryKey: ["budgets", params],
    queryFn: () => fetchBudget(params.month, params.year),
  });
};

export const budgetHistoryQueryOptions = (params?: {
  page?: number;
  limit?: number;
}) => {
  return queryOptions({
    queryKey: ["budgets", params],
    queryFn: () => fetchBudgets(params),
  });
};

export const useBudgetMutationOptions = () => {
  const queryClient = useQueryClient();

  return mutationOptions({
    mutationFn: mutateBudget,
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["budgets"] });
    },
  });
};

// Update budget item
const updateBudgetItem = async (
  itemId: string,
  allocation: number,
  budgetId: string,
): Promise<BudgetItem> => {
  const payload = {
    allocation,
    budget_id: budgetId,
  };

  const data = await financeApi.patch<BudgetItemResponse>(
    `/budgets/items/${itemId}`,
    payload,
  );

  return mapBudgetItem(data);
};

export const useBudgetItemMutationOptions = () => {
  const queryClient = useQueryClient();

  return mutationOptions({
    mutationFn: ({
      itemId,
      allocation,
      budgetId,
    }: {
      itemId: string;
      allocation: number;
      budgetId: string;
    }) => updateBudgetItem(itemId, allocation, budgetId),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["budgets"] });
    },
  });
};
