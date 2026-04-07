"use client";

import { investmentApi } from "@repo/common/lib/http";
import type {
  AutoSnapshotResult,
  CashFlow,
  CashFlowResponse,
  CorrelationMatrix,
  NavBreakdownItem,
  NavResponse,
  NavResult,
  PaginatedPortfoliosResult,
  PerformanceMetrics,
  PerformanceMetricsResponse,
  Portfolio,
  PortfolioAllocation,
  PortfolioAllocationResponse,
  PortfolioResponse,
  PortfoliosApiResponse,
  Position,
  PositionResponse,
  PositionWithPnl,
  PositionWithPnlResponse,
  SnapshotHistoryItem,
  Trade,
  TradeResponse,
} from "@repo/common/types/investment";
import {
  mutationOptions,
  queryOptions,
  useQueryClient,
} from "@tanstack/react-query";
import { buildSearchParams } from "../utils/url";

// ─── Mappers ─────────────────────────────────────────────────────────────────

const mapPortfolio = (r: PortfolioResponse): Portfolio => ({
  id: r.id,
  name: r.name,
  mode: r.mode,
  initialCapital: r.initial_capital,
  currency: r.currency,
  status: r.status,
  deletedAt: r.deleted_at ?? null,
});

const mapPosition = (r: PositionResponse): Position => ({
  id: r.id,
  portfolioId: r.portfolio_id,
  instrumentId: r.instrument_id,
  quantity: r.quantity,
  averageCost: r.average_cost,
  side: r.side,
  openedAt: r.opened_at,
  closedAt: r.closed_at ?? null,
});

const mapPerformanceMetrics = (
  r: PerformanceMetricsResponse,
): PerformanceMetrics => ({
  portfolioId: r.portfolio_id,
  totalReturn: r.total_return,
  totalReturnPct: r.total_return_pct,
  sharpeRatio: r.sharpe_ratio,
  maxDrawdown: r.max_drawdown,
  maxDrawdownPct: r.max_drawdown_pct,
  volatility: r.volatility,
  winRate: r.win_rate,
  snapshotCount: r.snapshot_count,
  periodStart: r.period_start,
  periodEnd: r.period_end,
  twr: r.twr,
  cagr: r.cagr,
  sortinoRatio: r.sortino_ratio,
  calmarRatio: r.calmar_ratio,
  profitFactor: r.profit_factor,
  var95: r.var_95,
  var99: r.var_99,
  cvar95: r.cvar_95,
  cvar99: r.cvar_99,
});

const mapNavResult = (r: NavResponse): NavResult => ({
  nav: r.nav,
  cash: r.cash,
  pricesFrom: r.prices_from,
  breakdown: r.breakdown.map(
    (item): NavBreakdownItem => ({
      ticker: item.ticker,
      side: item.side,
      quantity: item.quantity,
      price: item.price,
      priceDate: item.price_date,
      isStale: item.is_stale,
      value: item.value,
      isFallback: item.is_fallback,
    }),
  ),
});

const mapPositionWithPnl = (r: PositionWithPnlResponse): PositionWithPnl => ({
  id: r.id,
  portfolioId: r.portfolio_id,
  instrumentId: r.instrument_id,
  ticker: r.ticker,
  assetClass: r.asset_class,
  quantity: r.quantity,
  averageCost: r.average_cost,
  side: r.side,
  openedAt: r.opened_at,
  currentPrice: r.current_price,
  marketValue: r.market_value,
  costBasis: r.cost_basis,
  unrealizedPnl: r.unrealized_pnl,
  unrealizedPnlPct: r.unrealized_pnl_pct,
  weight: r.weight,
  isStale: r.is_stale,
  priceDate: r.price_date,
});

const mapAllocation = (
  r: PortfolioAllocationResponse,
): PortfolioAllocation => ({
  byInstrument: r.by_instrument.map((item) => ({
    instrumentId: item.instrument_id,
    ticker: item.ticker,
    assetClass: item.asset_class,
    weight: item.weight,
    value: item.value,
  })),
  byAssetClass: r.by_asset_class.map((item) => ({
    assetClass: item.asset_class,
    weight: item.weight,
    value: item.value,
  })),
  herfindahlIndex: r.herfindahl_index,
  totalValue: r.total_value,
});

const mapTrade = (r: TradeResponse): Trade => ({
  id: r.id,
  portfolioId: r.portfolio_id,
  positionId: r.position_id,
  instrumentId: r.instrument_id,
  side: r.side,
  quantity: r.quantity,
  price: r.price,
  fees: r.fees,
  realizedPnl: r.realized_pnl,
  timestamp: r.timestamp,
  createdAt: r.created_at,
});

const mapCashFlow = (r: CashFlowResponse): CashFlow => ({
  id: r.id,
  portfolioId: r.portfolio_id,
  type: r.type,
  amount: r.amount,
  description: r.description,
  timestamp: r.timestamp,
  createdAt: r.created_at,
});

// ─── Fetch functions ──────────────────────────────────────────────────────────

const fetchPortfolios = async (params?: {
  page?: number;
  limit?: number;
}): Promise<PaginatedPortfoliosResult> => {
  const qs = buildSearchParams({ page: params?.page, limit: params?.limit });
  const query = qs.toString();
  const url = query ? `/portfolios?${query}` : "/portfolios";

  const data = await investmentApi.get<PortfoliosApiResponse>(url, {
    unwrapData: false,
  });

  return {
    portfolios: data.data ? data.data.map(mapPortfolio) : [],
    pagination: data.meta?.pagination,
  };
};

const fetchPortfolio = async (id: string): Promise<Portfolio> => {
  const data = await investmentApi.get<PortfolioResponse>(`/portfolios/${id}`);
  return mapPortfolio(data);
};

const createPortfolio = async (
  payload: Pick<Portfolio, "name" | "mode" | "initialCapital" | "currency">,
): Promise<Portfolio> => {
  const data = await investmentApi.post<PortfolioResponse>(
    "/portfolios",
    payload,
  );
  return mapPortfolio(data);
};
const deletePortfolio = async (id: string): Promise<void> => {
  await investmentApi.delete(`/portfolios/${id}`);
};

const fetchPositions = async (
  portfolioId: string,
  openOnly = true,
): Promise<Position[]> => {
  const data = await investmentApi.get<PositionResponse[]>(
    `/portfolios/${portfolioId}/positions?openOnly=${openOnly}`,
  );
  return data.map(mapPosition);
};

const addPosition = async (
  portfolioId: string,
  payload: Omit<Position, "id" | "portfolioId" | "closedAt"> & {
    fees?: number;
  },
): Promise<Position> => {
  const data = await investmentApi.post<PositionResponse>(
    `/portfolios/${portfolioId}/positions`,
    {
      instrumentId: payload.instrumentId,
      quantity: payload.quantity,
      averageCost: payload.averageCost,
      side: payload.side,
      openedAt: payload.openedAt,
      fees: payload.fees,
    },
  );
  return mapPosition(data);
};

const closePosition = async (
  portfolioId: string,
  positionId: string,
  payload: { price: number; quantity?: number; fees?: number },
): Promise<Position> => {
  const data = await investmentApi.delete<PositionResponse>(
    `/portfolios/${portfolioId}/positions/${positionId}`,
    { json: payload },
  );
  return mapPosition(data);
};

const fetchPerformanceMetrics = async (
  portfolioId: string,
): Promise<PerformanceMetrics> => {
  const data = await investmentApi.get<PerformanceMetricsResponse>(
    `/portfolios/${portfolioId}/performance`,
  );
  return mapPerformanceMetrics(data);
};

const fetchComputeNav = async (portfolioId: string): Promise<NavResult> => {
  const data = await investmentApi.get<NavResponse>(
    `/portfolios/${portfolioId}/performance/nav`,
  );
  return mapNavResult(data);
};

const fetchSnapshotHistory = async (
  portfolioId: string,
  startDate?: string,
  endDate?: string,
): Promise<SnapshotHistoryItem[]> => {
  const qs = buildSearchParams({ startDate, endDate });
  const query = qs.toString();
  const url = query
    ? `/portfolios/${portfolioId}/performance/snapshots?${query}`
    : `/portfolios/${portfolioId}/performance/snapshots`;
  return investmentApi.get<SnapshotHistoryItem[]>(url);
};

const fetchPositionsWithPnl = async (
  portfolioId: string,
): Promise<PositionWithPnl[]> => {
  const data = await investmentApi.get<PositionWithPnlResponse[]>(
    `/portfolios/${portfolioId}/positions/pnl`,
  );
  return data.map(mapPositionWithPnl);
};

const fetchAllocation = async (
  portfolioId: string,
): Promise<PortfolioAllocation> => {
  const data = await investmentApi.get<PortfolioAllocationResponse>(
    `/portfolios/${portfolioId}/allocation`,
  );
  return mapAllocation(data);
};

const fetchTrades = async (
  portfolioId: string,
  offset = 0,
  limit = 50,
): Promise<Trade[]> => {
  const data = await investmentApi.get<TradeResponse[]>(
    `/portfolios/${portfolioId}/trades?offset=${offset}&limit=${limit}`,
  );
  return data.map(mapTrade);
};

const fetchCashFlows = async (
  portfolioId: string,
  offset = 0,
  limit = 50,
): Promise<CashFlow[]> => {
  const data = await investmentApi.get<CashFlowResponse[]>(
    `/portfolios/${portfolioId}/cash-flows?offset=${offset}&limit=${limit}`,
  );
  return data.map(mapCashFlow);
};

const recordCashFlow = async (
  portfolioId: string,
  payload: {
    type: CashFlow["type"];
    amount: number;
    description?: string;
    timestamp?: string;
  },
): Promise<CashFlow> => {
  const data = await investmentApi.post<CashFlowResponse>(
    `/portfolios/${portfolioId}/cash-flows`,
    payload,
  );
  return mapCashFlow(data);
};

const deleteCashFlow = async (
  portfolioId: string,
  cashFlowId: string,
): Promise<void> => {
  await investmentApi.delete(
    `/portfolios/${portfolioId}/cash-flows/${cashFlowId}`,
  );
};

// ─── Query / Mutation options ─────────────────────────────────────────────────

export const portfoliosQueryOptions = (params?: {
  page?: number;
  limit?: number;
}) =>
  queryOptions({
    queryKey: ["portfolios", params],
    queryFn: () => fetchPortfolios(params),
  });

export const portfolioQueryOptions = (id: string) =>
  queryOptions({
    queryKey: ["portfolios", id],
    queryFn: () => fetchPortfolio(id),
    enabled: !!id,
  });

export const useCreatePortfolioMutationOptions = () => {
  const queryClient = useQueryClient();
  return mutationOptions({
    mutationFn: createPortfolio,
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: ["portfolios"] }),
  });
};
export const useDeletePortfolioMutationOptions = () => {
  const queryClient = useQueryClient();
  return mutationOptions({
    mutationFn: deletePortfolio,
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: ["portfolios"] });
      const previous = queryClient.getQueryData(["portfolios"]);
      queryClient.setQueryData(
        ["portfolios"],
        (old: PaginatedPortfoliosResult | undefined) => {
          if (!old) return old;
          return {
            ...old,
            portfolios: old.portfolios.filter((p) => p.id !== id),
          };
        },
      );
      return { previous };
    },
    onError: (_err, _id, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["portfolios"], context.previous);
      }
    },
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: ["portfolios"] }),
  });
};

export const positionsQueryOptions = (portfolioId: string, openOnly = true) =>
  queryOptions({
    queryKey: ["positions", portfolioId, openOnly],
    queryFn: () => fetchPositions(portfolioId, openOnly),
    enabled: !!portfolioId,
  });

export const useAddPositionMutationOptions = (portfolioId: string) => {
  const queryClient = useQueryClient();
  return mutationOptions({
    mutationFn: (
      payload: Omit<Position, "id" | "portfolioId" | "closedAt"> & {
        fees?: number;
      },
    ) => addPosition(portfolioId, payload),
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: ["positions", portfolioId] }),
  });
};

export const useClosePositionMutationOptions = (portfolioId: string) => {
  const queryClient = useQueryClient();
  return mutationOptions({
    mutationFn: ({
      positionId,
      ...payload
    }: {
      positionId: string;
      price: number;
      quantity?: number;
      fees?: number;
    }) => closePosition(portfolioId, positionId, payload),
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: ["positions", portfolioId] }),
  });
};

export const performanceQueryOptions = (portfolioId: string) =>
  queryOptions({
    queryKey: ["performance", portfolioId],
    queryFn: () => fetchPerformanceMetrics(portfolioId),
    enabled: !!portfolioId,
  });

export const useRecordSnapshotMutationOptions = (portfolioId: string) => {
  const queryClient = useQueryClient();
  return mutationOptions({
    mutationFn: (payload: { nav: number; cash: number }) =>
      investmentApi.post(
        `/portfolios/${portfolioId}/performance/snapshot`,
        payload,
      ),
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: ["performance", portfolioId] }),
  });
};

export const computeNavQueryOptions = (portfolioId: string) =>
  queryOptions({
    queryKey: ["nav", portfolioId],
    queryFn: () => fetchComputeNav(portfolioId),
    enabled: !!portfolioId,
    staleTime: 30_000,
  });

export const useAutoSnapshotMutationOptions = (portfolioId: string) => {
  const queryClient = useQueryClient();
  return mutationOptions({
    mutationFn: (): Promise<AutoSnapshotResult> =>
      investmentApi.post(
        `/portfolios/${portfolioId}/performance/auto-snapshot`,
        {},
      ),
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: ["performance", portfolioId] }),
  });
};

export const snapshotHistoryQueryOptions = (
  portfolioId: string,
  startDate?: string,
  endDate?: string,
) =>
  queryOptions({
    queryKey: ["snapshot-history", portfolioId, startDate, endDate],
    queryFn: () => fetchSnapshotHistory(portfolioId, startDate, endDate),
    enabled: !!portfolioId,
  });

export const positionsWithPnlQueryOptions = (portfolioId: string) =>
  queryOptions({
    queryKey: ["positions-pnl", portfolioId],
    queryFn: () => fetchPositionsWithPnl(portfolioId),
    enabled: !!portfolioId,
    staleTime: 30_000,
  });

export const allocationQueryOptions = (portfolioId: string) =>
  queryOptions({
    queryKey: ["allocation", portfolioId],
    queryFn: () => fetchAllocation(portfolioId),
    enabled: !!portfolioId,
    staleTime: 60_000,
  });

export const tradesQueryOptions = (
  portfolioId: string,
  offset = 0,
  limit = 50,
) =>
  queryOptions({
    queryKey: ["trades", portfolioId, offset, limit],
    queryFn: () => fetchTrades(portfolioId, offset, limit),
    enabled: !!portfolioId,
  });

export const cashFlowsQueryOptions = (
  portfolioId: string,
  offset = 0,
  limit = 50,
) =>
  queryOptions({
    queryKey: ["cash-flows", portfolioId, offset, limit],
    queryFn: () => fetchCashFlows(portfolioId, offset, limit),
    enabled: !!portfolioId,
  });

export const useRecordCashFlowMutationOptions = (portfolioId: string) => {
  const queryClient = useQueryClient();
  return mutationOptions({
    mutationFn: (payload: {
      type: CashFlow["type"];
      amount: number;
      description?: string;
      timestamp?: string;
    }) => recordCashFlow(portfolioId, payload),
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: ["cash-flows", portfolioId] }),
  });
};

export const useDeleteCashFlowMutationOptions = (portfolioId: string) => {
  const queryClient = useQueryClient();
  return mutationOptions({
    mutationFn: (cashFlowId: string) => deleteCashFlow(portfolioId, cashFlowId),
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: ["cash-flows", portfolioId] }),
  });
};

const fetchCorrelationMatrix = async (
  portfolioId: string,
): Promise<CorrelationMatrix> => {
  return investmentApi.get<CorrelationMatrix>(
    `/portfolios/${portfolioId}/analytics/correlation`,
  );
};

export const correlationMatrixQueryOptions = (portfolioId: string) =>
  queryOptions({
    queryKey: ["correlation-matrix", portfolioId],
    queryFn: () => fetchCorrelationMatrix(portfolioId),
    enabled: !!portfolioId,
    staleTime: 300_000,
  });
