import type { JsonApiResponse, PaginationInfo } from "@repo/common/types";
import { z } from "zod";

// ─── Instrument ──────────────────────────────────────────────────────────────

export const instrumentSchema = z.object({
  id: z.string().optional(),
  ticker: z.string().min(1).max(20),
  name: z.string().min(1),
  assetClass: z.enum(["STOCK", "CRYPTO", "FOREX", "ETF", "COMMODITY"] as const),
  exchange: z.string().nullable().optional(),
  currency: z.string().min(3).max(10),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
});

export type Instrument = z.infer<typeof instrumentSchema>;

export type InstrumentResponse = {
  id: string;
  ticker: string;
  name: string;
  asset_class: string;
  exchange: string | null;
  currency: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

export type InstrumentsApiResponse = JsonApiResponse<InstrumentResponse[]>;

export type PaginatedInstrumentsResult = {
  instruments: Instrument[];
  pagination?: PaginationInfo;
};

// ─── Instrument Lookup (search external providers) ───────────────────────────

export type InstrumentLookupResult = {
  ticker: string;
  name: string;
  assetClass: "STOCK" | "CRYPTO" | "FOREX" | "ETF" | "COMMODITY";
  exchange: string | null;
  currency: string;
  source: "yahoo" | "coingecko";
};

// ─── Portfolio ────────────────────────────────────────────────────────────────

export const portfolioSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  mode: z.enum(["backtest", "paper", "live"] as const),
  initialCapital: z.number().positive(),
  currency: z.string().min(3).max(10),
  status: z.enum(["active", "paused", "closed"] as const).optional(),
  deletedAt: z.string().datetime().nullable().optional(),
});

export type Portfolio = z.infer<typeof portfolioSchema>;

export type PortfolioResponse = {
  id: string;
  user_id: string;
  name: string;
  mode: "backtest" | "paper" | "live";
  initial_capital: number;
  currency: string;
  status: "active" | "paused" | "closed";
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
  version: number;
};

export type PortfoliosApiResponse = JsonApiResponse<PortfolioResponse[]>;

export type PaginatedPortfoliosResult = {
  portfolios: Portfolio[];
  pagination?: PaginationInfo;
};

// ─── Position ─────────────────────────────────────────────────────────────────

export const positionSchema = z.object({
  id: z.string().optional(),
  portfolioId: z.string(),
  instrumentId: z.string(),
  quantity: z.number().positive(),
  averageCost: z.number().positive(),
  side: z.enum(["LONG", "SHORT"] as const),
  openedAt: z.string().datetime(),
  closedAt: z.string().datetime().nullable().optional(),
});

export type Position = z.infer<typeof positionSchema>;

export type PositionResponse = {
  id: string;
  portfolio_id: string;
  instrument_id: string;
  quantity: number;
  average_cost: number;
  side: "LONG" | "SHORT";
  opened_at: string;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
};

// ─── Position with P&L ───────────────────────────────────────────────────────

export type PositionWithPnlResponse = {
  id: string;
  portfolio_id: string;
  instrument_id: string;
  ticker: string;
  asset_class: string;
  quantity: number;
  average_cost: number;
  side: string;
  opened_at: string;
  current_price: number;
  market_value: number;
  cost_basis: number;
  unrealized_pnl: number;
  unrealized_pnl_pct: number;
  weight: number;
  is_stale: boolean;
  price_date: string | null;
};

export type PositionWithPnl = {
  id: string;
  portfolioId: string;
  instrumentId: string;
  ticker: string;
  assetClass: string;
  quantity: number;
  averageCost: number;
  side: string;
  openedAt: string;
  currentPrice: number;
  marketValue: number;
  costBasis: number;
  unrealizedPnl: number;
  unrealizedPnlPct: number;
  weight: number;
  isStale: boolean;
  priceDate: string | null;
};

// ─── Portfolio Allocation ─────────────────────────────────────────────────────

export type AllocationByInstrumentResponse = {
  instrument_id: string;
  ticker: string;
  asset_class: string;
  weight: number;
  value: number;
};

export type AllocationByAssetClassResponse = {
  asset_class: string;
  weight: number;
  value: number;
};

export type PortfolioAllocationResponse = {
  by_instrument: AllocationByInstrumentResponse[];
  by_asset_class: AllocationByAssetClassResponse[];
  herfindahl_index: number;
  total_value: number;
};

export type PortfolioAllocation = {
  byInstrument: {
    instrumentId: string;
    ticker: string;
    assetClass: string;
    weight: number;
    value: number;
  }[];
  byAssetClass: { assetClass: string; weight: number; value: number }[];
  herfindahlIndex: number;
  totalValue: number;
};

// ─── Trade ────────────────────────────────────────────────────────────────────

export type TradeResponse = {
  id: string;
  portfolio_id: string;
  position_id: string | null;
  instrument_id: string;
  side: "BUY" | "SELL";
  quantity: number;
  price: number;
  fees: number;
  realized_pnl: number | null;
  timestamp: string;
  created_at: string;
};

export type Trade = {
  id: string;
  portfolioId: string;
  positionId: string | null;
  instrumentId: string;
  side: "BUY" | "SELL";
  quantity: number;
  price: number;
  fees: number;
  realizedPnl: number | null;
  timestamp: string;
  createdAt: string;
};

// ─── Cash Flow ────────────────────────────────────────────────────────────────

export type CashFlowResponse = {
  id: string;
  portfolio_id: string;
  type: "DEPOSIT" | "WITHDRAWAL" | "DIVIDEND" | "FEE";
  amount: number;
  description: string | null;
  timestamp: string;
  created_at: string;
};

export type CashFlow = {
  id: string;
  portfolioId: string;
  type: "DEPOSIT" | "WITHDRAWAL" | "DIVIDEND" | "FEE";
  amount: number;
  description: string | null;
  timestamp: string;
  createdAt: string;
};

// ─── Snapshot History ─────────────────────────────────────────────────────────

export type SnapshotHistoryItem = {
  timestamp: string;
  nav: number;
  cash: number;
  drawdown: number;
};

// ─── OHLCV ───────────────────────────────────────────────────────────────────

export type OhlcvResponse = {
  instrument_id: string;
  timestamp: string;
  timeframe: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export type Ohlcv = {
  instrumentId: string;
  timestamp: string;
  timeframe: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

// ─── Performance Metrics ─────────────────────────────────────────────────────

export type PerformanceMetricsResponse = {
  portfolio_id: string;
  total_return: number;
  total_return_pct: number;
  sharpe_ratio: number | null;
  max_drawdown: number;
  max_drawdown_pct: number;
  volatility: number | null;
  win_rate: number | null;
  snapshot_count: number;
  period_start: string | null;
  period_end: string | null;
  twr: number | null;
  cagr: number | null;
  sortino_ratio: number | null;
  calmar_ratio: number | null;
  profit_factor: number | null;
  var_95: number | null;
  var_99: number | null;
  cvar_95: number | null;
  cvar_99: number | null;
};

export type PerformanceMetrics = {
  portfolioId: string;
  totalReturn: number;
  totalReturnPct: number;
  sharpeRatio: number | null;
  maxDrawdown: number;
  maxDrawdownPct: number;
  volatility: number | null;
  winRate: number | null;
  snapshotCount: number;
  periodStart: string | null;
  periodEnd: string | null;
  twr: number | null;
  cagr: number | null;
  sortinoRatio: number | null;
  calmarRatio: number | null;
  profitFactor: number | null;
  var95: number | null;
  var99: number | null;
  cvar95: number | null;
  cvar99: number | null;
};

// ─── NAV Computation ──────────────────────────────────────────────────────────

export type NavBreakdownItemResponse = {
  ticker: string;
  side: string;
  quantity: number;
  price: number;
  price_date: string | null;
  is_stale: boolean;
  value: number;
  is_fallback: boolean;
};

export type NavResponse = {
  nav: number;
  cash: number;
  prices_from: "ohlcv" | "fallback";
  breakdown: NavBreakdownItemResponse[];
};

export type NavBreakdownItem = {
  ticker: string;
  side: string;
  quantity: number;
  price: number;
  priceDate: string | null;
  isStale: boolean;
  value: number;
  isFallback: boolean;
};

export type NavResult = {
  nav: number;
  cash: number;
  pricesFrom: "ohlcv" | "fallback";
  breakdown: NavBreakdownItem[];
};

export type AutoSnapshotResult = {
  snapshotId: string;
  nav: number;
  cash: number;
  recordedAt: string;
};

// ─── Correlation Matrix ───────────────────────────────────────────────────────

export type CorrelationMatrix = {
  tickers: string[];
  matrix: number[][];
};
