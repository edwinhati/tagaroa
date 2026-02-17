"use client";

import { financeApi } from "@repo/common/lib/http";
import type {
  AccountAggregationsResult,
  BudgetPerformanceResult,
  ExpenseBreakdownResult,
  InsightsResult,
  NetWorthResult,
  SummaryResult,
  TransactionTrendsResult,
} from "@repo/common/types/finance-dashboard";
import { queryOptions } from "@tanstack/react-query";

const fetchDashboardSummary = async (params?: {
  startDate?: string;
  endDate?: string;
}): Promise<SummaryResult> => {
  const searchParams = new URLSearchParams();

  if (params?.startDate) searchParams.append("start_date", params.startDate);
  if (params?.endDate) searchParams.append("end_date", params.endDate);

  const queryString = searchParams.toString();
  const url = queryString
    ? `/dashboard/summary?${queryString}`
    : "/dashboard/summary";

  type DashboardSummaryResponse = {
    data: SummaryResult;
  };
  const response = await financeApi.get<DashboardSummaryResponse>(url, {
    unwrapData: false,
  });
  return response.data;
};

const fetchAccountAggregations =
  async (): Promise<AccountAggregationsResult> => {
    type AccountAggregationsResponse = {
      data: AccountAggregationsResult;
    };
    const response = await financeApi.get<AccountAggregationsResponse>(
      "/dashboard/account-aggregations",
      { unwrapData: false },
    );
    return response.data;
  };

const fetchBudgetPerformance = async (params?: {
  month?: number;
  year?: number;
}): Promise<BudgetPerformanceResult> => {
  const searchParams = new URLSearchParams();

  if (params?.month) searchParams.append("month", params.month.toString());
  if (params?.year) searchParams.append("year", params.year.toString());

  const queryString = searchParams.toString();
  const url = queryString
    ? `/dashboard/budget-performance?${queryString}`
    : "/dashboard/budget-performance";

  type BudgetPerformanceResponse = {
    data: BudgetPerformanceResult;
  };
  const response = await financeApi.get<BudgetPerformanceResponse>(url, {
    unwrapData: false,
  });
  return response.data;
};

const fetchTransactionTrends = async (params?: {
  startDate?: string;
  endDate?: string;
}): Promise<TransactionTrendsResult> => {
  const searchParams = new URLSearchParams();

  if (params?.startDate) searchParams.append("start_date", params.startDate);
  if (params?.endDate) searchParams.append("end_date", params.endDate);

  const queryString = searchParams.toString();
  const url = queryString
    ? `/dashboard/transaction-trends?${queryString}`
    : "/dashboard/transaction-trends";

  type TransactionTrendsResponse = {
    data: TransactionTrendsResult;
  };
  const response = await financeApi.get<TransactionTrendsResponse>(url, {
    unwrapData: false,
  });
  return response.data;
};

const fetchExpenseBreakdown = async (params?: {
  startDate?: string;
  endDate?: string;
}): Promise<ExpenseBreakdownResult> => {
  const searchParams = new URLSearchParams();

  if (params?.startDate) searchParams.append("start_date", params.startDate);
  if (params?.endDate) searchParams.append("end_date", params.endDate);

  const queryString = searchParams.toString();
  const url = queryString
    ? `/dashboard/expense-breakdown?${queryString}`
    : "/dashboard/expense-breakdown";

  type ExpenseBreakdownResponse = {
    data: ExpenseBreakdownResult;
  };
  const response = await financeApi.get<ExpenseBreakdownResponse>(url, {
    unwrapData: false,
  });
  return response.data;
};

const fetchNetWorth = async (params?: {
  startDate?: string;
  endDate?: string;
  currency?: string;
}): Promise<NetWorthResult> => {
  const searchParams = new URLSearchParams();

  if (params?.startDate) searchParams.append("start_date", params.startDate);
  if (params?.endDate) searchParams.append("end_date", params.endDate);
  if (params?.currency) searchParams.append("currency", params.currency);

  const queryString = searchParams.toString();
  const url = queryString
    ? `/dashboard/net-worth?${queryString}`
    : "/dashboard/net-worth";

  type NetWorthResponse = {
    data: NetWorthResult;
  };
  const response = await financeApi.get<NetWorthResponse>(url, {
    unwrapData: false,
  });
  return response.data;
};

const fetchInsights = async (params: {
  startDate: string;
  endDate: string;
}): Promise<InsightsResult> => {
  const searchParams = new URLSearchParams();

  searchParams.append("start_date", params.startDate);
  searchParams.append("end_date", params.endDate);

  const url = `/dashboard/insights?${searchParams.toString()}`;

  type InsightsResponse = {
    data: InsightsResult;
  };
  const response = await financeApi.get<InsightsResponse>(url, {
    unwrapData: false,
  });
  return response.data;
};

export const dashboardSummaryQueryOptions = (params?: {
  startDate?: string;
  endDate?: string;
}) => {
  return queryOptions({
    queryKey: ["dashboard-summary", params],
    queryFn: () => fetchDashboardSummary(params),
  });
};

export const accountAggregationsQueryOptions = () => {
  return queryOptions({
    queryKey: ["account-aggregations"],
    queryFn: fetchAccountAggregations,
  });
};

export const budgetPerformanceQueryOptions = (params?: {
  month?: number;
  year?: number;
}) => {
  return queryOptions({
    queryKey: ["budget-performance", params],
    queryFn: () => fetchBudgetPerformance(params),
  });
};

export const transactionTrendsQueryOptions = (params?: {
  startDate?: string;
  endDate?: string;
}) => {
  return queryOptions({
    queryKey: ["transaction-trends", params],
    queryFn: () => fetchTransactionTrends(params),
  });
};

export const expenseBreakdownQueryOptions = (params?: {
  startDate?: string;
  endDate?: string;
}) => {
  return queryOptions({
    queryKey: ["expense-breakdown", params],
    queryFn: () => fetchExpenseBreakdown(params),
  });
};

export const netWorthQueryOptions = (params?: {
  startDate?: string;
  endDate?: string;
  currency?: string;
}) => {
  return queryOptions({
    queryKey: ["net-worth", params],
    queryFn: () => fetchNetWorth(params),
  });
};

export const insightsQueryOptions = (params: {
  startDate: string;
  endDate: string;
}) => {
  return queryOptions({
    queryKey: ["insights", params],
    queryFn: () => fetchInsights(params),
  });
};
