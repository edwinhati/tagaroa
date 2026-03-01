"use client";

import {
  deleteInstrumentMutationOptions,
  instrumentsQueryOptions,
  latestPricesQueryOptions,
  ohlcvQueryOptions,
  refreshInstrumentMetadataMutationOptions,
  syncOhlcvMutationOptions,
} from "@repo/common/lib/query/instrument-query";
import type { Instrument } from "@repo/common/types/investment";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@repo/ui/components/alert-dialog";
import { Button } from "@repo/ui/components/button";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@repo/ui/components/context-menu";
import { Input } from "@repo/ui/components/input";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@repo/ui/components/resizable";
import { Skeleton } from "@repo/ui/components/skeleton";
import { cn } from "@repo/ui/lib/utils";
import {
  IconChartCandle,
  IconChartLine,
  IconChevronLeft,
  IconChevronRight,
  IconRefresh,
  IconSearch,
  IconTelescope,
  IconTrash,
  IconTrendingDown,
  IconTrendingUp,
  IconX,
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Area, AreaChart, ResponsiveContainer, Tooltip } from "recharts";
import { toast } from "sonner";
import { type CandlePoint, computeMetrics } from "../lib/compute-metrics";
import { InstrumentDialogForm } from "./instrument-dialog-form";
import { TradingViewChart } from "./trading-view-chart";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ASSET_CLASSES = [
  { value: "", label: "All" },
  { value: "STOCK", label: "Stocks" },
  { value: "CRYPTO", label: "Crypto" },
  { value: "FOREX", label: "Forex" },
  { value: "ETF", label: "ETFs" },
  { value: "COMMODITY", label: "Commod." },
] as const;

const CLASS_CONFIG: Record<
  string,
  { bg: string; text: string; border: string; dot: string; strip: string }
> = {
  STOCK: {
    bg: "bg-blue-500/10",
    text: "text-blue-500 dark:text-blue-400",
    border: "border-blue-500/20",
    dot: "bg-blue-500",
    strip: "bg-blue-500",
  },
  CRYPTO: {
    bg: "bg-amber-500/10",
    text: "text-amber-500 dark:text-amber-400",
    border: "border-amber-500/20",
    dot: "bg-amber-500",
    strip: "bg-amber-500",
  },
  FOREX: {
    bg: "bg-purple-500/10",
    text: "text-purple-500 dark:text-purple-400",
    border: "border-purple-500/20",
    dot: "bg-purple-500",
    strip: "bg-purple-500",
  },
  ETF: {
    bg: "bg-emerald-500/10",
    text: "text-emerald-500 dark:text-emerald-400",
    border: "border-emerald-500/20",
    dot: "bg-emerald-500",
    strip: "bg-emerald-500",
  },
  COMMODITY: {
    bg: "bg-orange-500/10",
    text: "text-orange-500 dark:text-orange-400",
    border: "border-orange-500/20",
    dot: "bg-orange-500",
    strip: "bg-orange-500",
  },
};

const DEFAULT_CLASS_CONFIG = {
  bg: "bg-muted",
  text: "text-muted-foreground",
  border: "border-border",
  dot: "bg-muted-foreground",
  strip: "bg-muted-foreground",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type ChartTab = "live" | "history";
type TimeRange = "1W" | "1M" | "3M" | "6M" | "1Y" | "All";

const TIME_RANGES: { value: TimeRange; days: number }[] = [
  { value: "1W", days: 7 },
  { value: "1M", days: 30 },
  { value: "3M", days: 90 },
  { value: "6M", days: 180 },
  { value: "1Y", days: 365 },
  { value: "All", days: 1825 },
];

function formatCompactPrice(val: number): string {
  if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(2)}M`;
  if (val >= 1_000)
    return val.toLocaleString("en-US", { maximumFractionDigits: 2 });
  if (val < 0.01) return val.toFixed(6);
  if (val < 1) return val.toFixed(4);
  return val.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

function toTradingViewSymbol(ticker: string, exchange?: string | null): string {
  if (!exchange) return ticker;
  const EXCHANGE_MAP: Record<string, string> = {
    NASDAQ: "NASDAQ",
    NYSE: "NYSE",
    AMEX: "AMEX",
    TSX: "TSX",
    LSE: "LSE",
    ASX: "ASX",
    HKEX: "HKEX",
    NSE: "NSE",
    BSE: "BSE",
    SGX: "SGX",
    BINANCE: "BINANCE",
    COINBASE: "COINBASE",
    KRAKEN: "KRAKEN",
    FOREX: "FX",
    FX: "FX",
    CME: "CME",
    NYMEX: "NYMEX",
  };
  const prefix = EXCHANGE_MAP[exchange.toUpperCase()] ?? exchange.toUpperCase();
  return `${prefix}:${ticker}`;
}

// ---------------------------------------------------------------------------
// Market status
// ---------------------------------------------------------------------------

type MarketStatus = "open" | "pre" | "after" | "closed";

const MARKET_STATUS_CONFIG: Record<
  MarketStatus,
  { dot: string; label: string; text: string }
> = {
  open: {
    dot: "bg-emerald-500",
    label: "Open",
    text: "text-emerald-500",
  },
  pre: {
    dot: "bg-amber-400",
    label: "Pre",
    text: "text-amber-400",
  },
  after: {
    dot: "bg-amber-400",
    label: "After",
    text: "text-amber-400",
  },
  closed: {
    dot: "bg-muted-foreground/30",
    label: "Closed",
    text: "text-muted-foreground/50",
  },
};

function getMarketStatus(
  _exchange: string | null | undefined,
  assetClass: string,
): MarketStatus {
  if (assetClass === "CRYPTO") return "open";

  const now = new Date();
  // Approximate ET: UTC-5 (good enough for status display)
  const etMins = now.getUTCHours() * 60 + now.getUTCMinutes() - 5 * 60;
  const normalised = ((etMins % (24 * 60)) + 24 * 60) % (24 * 60);
  const etDay = (now.getUTCDay() + Math.floor(etMins / (24 * 60)) + 7) % 7;

  if (assetClass === "STOCK" || assetClass === "ETF") {
    if (etDay === 0 || etDay === 6) return "closed";
    const PRE = 4 * 60;
    const OPEN = 9 * 60 + 30;
    const CLOSE = 16 * 60;
    const AFTER = 20 * 60;
    if (normalised >= OPEN && normalised < CLOSE) return "open";
    if (normalised >= PRE && normalised < OPEN) return "pre";
    if (normalised >= CLOSE && normalised < AFTER) return "after";
    return "closed";
  }

  if (assetClass === "FOREX") {
    if (etDay === 6) return "closed";
    if (etDay === 5 && normalised >= 17 * 60) return "closed";
    if (etDay === 0 && normalised < 17 * 60) return "closed";
    return "open";
  }

  return "closed";
}

// ---------------------------------------------------------------------------
// AssetClassBadge — compact pill
// ---------------------------------------------------------------------------

function AssetClassBadge({ cls }: { cls: string }) {
  const config = CLASS_CONFIG[cls] ?? DEFAULT_CLASS_CONFIG;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded border px-1.5 py-px text-[10px] font-semibold leading-none tracking-wide",
        config.bg,
        config.text,
        config.border,
      )}
    >
      {cls}
    </span>
  );
}

// ---------------------------------------------------------------------------
// WatchlistRow — compact list item
// ---------------------------------------------------------------------------

function WatchlistRow({
  instrument,
  selected,
  price,
  onClick,
  onDelete,
}: {
  instrument: Instrument;
  selected: boolean;
  price?: number | null;
  onClick: () => void;
  onDelete?: () => void;
}) {
  const config = CLASS_CONFIG[instrument.assetClass] ?? DEFAULT_CLASS_CONFIG;

  return (
    <ContextMenu>
      <ContextMenuTrigger>
        <div
          role="button"
          tabIndex={0}
          onClick={onClick}
          onKeyDown={(e) => e.key === "Enter" && onClick()}
          className={cn(
            "relative w-full flex items-center gap-2.5 px-3 py-2.5 text-left",
            "border-b border-border/40 transition-colors cursor-pointer",
            "hover:bg-muted/40",
            selected && "bg-primary/8 hover:bg-primary/10",
          )}
        >
          {/* Left accent strip */}
          <span
            className={cn(
              "absolute left-0 top-0 bottom-0 w-[3px] transition-opacity",
              config.strip,
              selected ? "opacity-100" : "opacity-0",
            )}
          />

          {/* Asset class dot */}
          <span
            className={cn("h-1.5 w-1.5 rounded-full flex-shrink-0", config.dot)}
          />

          {/* Ticker + Name */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="font-mono font-bold text-sm leading-none">
                {instrument.ticker}
              </span>
              <AssetClassBadge cls={instrument.assetClass} />
            </div>
            <p className="mt-0.5 text-[11px] text-muted-foreground truncate leading-none">
              {instrument.name ?? "—"}
            </p>
          </div>

          {/* Price + Status */}
          {(() => {
            const status = getMarketStatus(
              instrument.exchange,
              instrument.assetClass,
            );
            const statusCfg = MARKET_STATUS_CONFIG[status];
            return (
              <div className="flex-shrink-0 text-right">
                <p
                  className={cn(
                    "font-mono text-xs font-semibold leading-none tabular-nums",
                    price != null
                      ? "text-foreground"
                      : "text-muted-foreground/30",
                  )}
                >
                  {price != null ? formatCompactPrice(price) : "—"}
                </p>
                <div className="mt-1 flex items-center justify-end gap-1">
                  <span
                    className={cn(
                      "inline-block h-1.5 w-1.5 rounded-full flex-shrink-0",
                      statusCfg.dot,
                      status === "open" && "animate-pulse",
                    )}
                  />
                  <span
                    className={cn(
                      "text-[9px] font-medium leading-none tracking-wide uppercase",
                      statusCfg.text,
                    )}
                  >
                    {statusCfg.label}
                  </span>
                </div>
              </div>
            );
          })()}

          {/* Chevron */}
          <IconChevronRight
            className={cn(
              "h-3.5 w-3.5 flex-shrink-0 text-muted-foreground/50 transition-transform",
              selected && "text-primary rotate-90",
            )}
          />
        </div>
      </ContextMenuTrigger>

      <ContextMenuContent>
        <ContextMenuItem onClick={onClick}>
          <IconChartLine className="h-4 w-4" />
          View Chart
        </ContextMenuItem>
        {onDelete && (
          <>
            <ContextMenuSeparator />
            <ContextMenuItem variant="destructive" onClick={onDelete}>
              <IconTrash className="h-4 w-4" />
              Remove
            </ContextMenuItem>
          </>
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
}

// ---------------------------------------------------------------------------
// AssetInfoPanel — quant-grade instrument information panel
// ---------------------------------------------------------------------------

function fmt(val: number | null | undefined, decimals = 2): string {
  if (val == null) return "—";
  return val.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function fmtCompact(val: number | null | undefined): string {
  if (val == null) return "—";
  if (val >= 1e12) return `${(val / 1e12).toFixed(2)}T`;
  if (val >= 1e9) return `${(val / 1e9).toFixed(2)}B`;
  if (val >= 1e6) return `${(val / 1e6).toFixed(2)}M`;
  if (val >= 1e3) return `${(val / 1e3).toFixed(1)}K`;
  return val.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

function fmtPercent(val: number | null | undefined): string {
  if (val == null) return "—";
  return `${(val * 100).toFixed(2)}%`;
}

function fmtRange(lo: number, hi: number, dec = 2): string {
  return `${fmt(lo, dec)} – ${fmt(hi, dec)}`;
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function StatBox({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: "positive" | "negative" | null;
}) {
  return (
    <div className="flex flex-col gap-0.5 rounded-lg border border-border/40 bg-muted/30 px-3 py-2.5">
      <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span
        className={cn(
          "text-sm font-semibold leading-tight tabular-nums",
          highlight === "positive" && "text-emerald-500",
          highlight === "negative" && "text-rose-500",
        )}
      >
        {value}
      </span>
    </div>
  );
}

function PanelSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border-b border-border/40 px-4 py-4">
      <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
        {title}
      </p>
      {children}
    </div>
  );
}

function AssetInfoPanel({ instrument }: { instrument: Instrument }) {
  const [descExpanded, setDescExpanded] = useState(false);
  const queryClient = useQueryClient();

  // Fetch 1Y candles for metric computation (deduped with chart's queries)
  const endDateStr = new Date().toISOString().split("T")[0] as string;
  const oneYearAgo = new Date();
  oneYearAgo.setDate(oneYearAgo.getDate() - 365);
  const startDateStr = oneYearAgo.toISOString().split("T")[0] as string;

  const { data: candles = [] } = useQuery(
    ohlcvQueryOptions({
      instrumentId: instrument.id ?? "",
      timeframe: "1d",
      startDate: startDateStr,
      endDate: endDateStr,
      limit: 1000,
    }),
  );

  const { mutate: refreshMeta, isPending: isRefreshing } = useMutation({
    ...refreshInstrumentMetadataMutationOptions(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["instruments"] });
      toast.success("Metadata refreshed");
    },
    onError: (err: Error) => toast.error(`Refresh failed: ${err.message}`),
  });

  const points: CandlePoint[] = candles.map((c) => ({
    date: new Date(c.timestamp).toISOString().split("T")[0] as string,
    open: c.open,
    high: c.high,
    low: c.low,
    close: c.close,
    volume: c.volume,
  }));

  const m = computeMetrics(points);
  const meta = instrument.metadata ?? {};
  const getMeta = <T,>(key: string): T | null =>
    (meta[key] as T | undefined) ?? null;

  const isStock =
    instrument.assetClass === "STOCK" || instrument.assetClass === "ETF";
  const isCrypto = instrument.assetClass === "CRYPTO";
  const dec = isCrypto && (m?.dayClose ?? 1) < 0.01 ? 6 : 2;

  // ── Key Statistics ────────────────────────────────────────────────────────
  type StatDef = {
    label: string;
    value: string;
    highlight?: "positive" | "negative" | null;
  };
  const hl = (
    above: boolean | null | undefined,
  ): "positive" | "negative" | null =>
    above === true ? "positive" : above === false ? "negative" : null;

  const prevClose = getMeta<number>("previousClose") ?? m?.prevClose;
  const keyStats: StatDef[] = [
    {
      label: "Prev Close",
      value: prevClose != null ? fmt(prevClose, dec) : "—",
    },
    { label: "Open", value: m ? fmt(m.dayOpen, dec) : "—" },
    { label: "Day Range", value: m ? fmtRange(m.dayLow, m.dayHigh, dec) : "—" },
    {
      label: "52W Range",
      value: m ? fmtRange(m.fiftyTwoWeekLow, m.fiftyTwoWeekHigh, dec) : "—",
    },
    ...(isStock
      ? ([
          {
            label: "Market Cap",
            value: fmtCompact(getMeta<number>("marketCap")),
          },
          { label: "P/E Ratio", value: fmt(getMeta<number>("peRatio")) },
          {
            label: "EPS",
            value:
              getMeta<number>("eps") != null
                ? `${instrument.currency} ${fmt(getMeta<number>("eps"))}`
                : "—",
          },
          {
            label: "Div Yield",
            value: fmtPercent(getMeta<number>("dividendYield")),
          },
          { label: "Beta", value: fmt(getMeta<number>("beta")) },
        ] as StatDef[])
      : isCrypto
        ? ([
            {
              label: "Market Cap",
              value: fmtCompact(getMeta<number>("marketCap")),
            },
            {
              label: "Circ. Supply",
              value:
                getMeta<number>("circulatingSupply") != null
                  ? `${fmtCompact(getMeta<number>("circulatingSupply"))} ${instrument.ticker}`
                  : "—",
            },
            {
              label: "Max Supply",
              value:
                getMeta<number>("maxSupply") != null
                  ? `${fmtCompact(getMeta<number>("maxSupply"))} ${instrument.ticker}`
                  : "Unlimited",
            },
            {
              label: "All-Time High",
              value: fmt(getMeta<number>("allTimeHigh"), dec),
            },
            {
              label: "ATH Date",
              value: fmtDate(getMeta<string>("allTimeHighDate")),
            },
          ] as StatDef[])
        : ([
            {
              label: "Avg Volume",
              value: fmtCompact(
                getMeta<number>("averageVolume") ?? m?.avgVolume20d,
              ),
            },
          ] as StatDef[])),
  ];

  // ── Technical Indicators ──────────────────────────────────────────────────
  const technicals: StatDef[] = [
    {
      label: "SMA 50",
      value: m?.sma50 != null ? fmt(m.sma50, dec) : "—",
      highlight: hl(m?.aboveSma50),
    },
    {
      label: "SMA 200",
      value: m?.sma200 != null ? fmt(m.sma200, dec) : "—",
      highlight: hl(m?.aboveSma200),
    },
    {
      label: "30D Volatility",
      value:
        m?.volatility30d != null
          ? `${(m.volatility30d * 100).toFixed(1)}%`
          : "—",
    },
    { label: "Avg Vol (20D)", value: fmtCompact(m?.avgVolume20d) },
    {
      label: "vs SMA 50",
      value:
        m?.aboveSma50 === true
          ? "Above"
          : m?.aboveSma50 === false
            ? "Below"
            : "—",
      highlight: hl(m?.aboveSma50),
    },
    {
      label: "vs SMA 200",
      value:
        m?.aboveSma200 === true
          ? "Above"
          : m?.aboveSma200 === false
            ? "Below"
            : "—",
      highlight: hl(m?.aboveSma200),
    },
  ].filter((t) => t.value !== "—");

  // ── About fields ──────────────────────────────────────────────────────────
  const description = getMeta<string>("description");
  const aboutFields = [
    isStock && { label: "Sector", value: getMeta<string>("sector") },
    isStock && { label: "Industry", value: getMeta<string>("industry") },
    isStock && { label: "CEO", value: getMeta<string>("ceo") },
    isStock && {
      label: "Employees",
      value:
        getMeta<number>("employees") != null
          ? Number(getMeta<number>("employees")).toLocaleString("en-US")
          : null,
    },
    isStock && { label: "Country", value: getMeta<string>("country") },
    isCrypto && { label: "Category", value: getMeta<string>("category") },
    isCrypto && {
      label: "Genesis Date",
      value:
        fmtDate(getMeta<string>("genesisDate")) !== "—"
          ? fmtDate(getMeta<string>("genesisDate"))
          : null,
    },
    { label: "Exchange", value: instrument.exchange },
    { label: "Website", value: getMeta<string>("website") },
  ].filter((f): f is { label: string; value: string } => !!f && !!f.value);

  return (
    <div className="flex flex-col">
      {/* Header row with refresh */}
      <div className="flex items-center justify-between border-b border-border/40 px-4 py-2.5">
        <span className="text-xs font-semibold">Details</span>
        <button
          type="button"
          onClick={() => instrument.id && refreshMeta(instrument.id)}
          disabled={isRefreshing}
          className="flex cursor-pointer items-center gap-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
          title="Refresh metadata from provider"
        >
          <IconRefresh
            className={cn("h-3 w-3", isRefreshing && "animate-spin")}
          />
          Refresh
        </button>
      </div>

      {/* Key Statistics */}
      <PanelSection title="Key Statistics">
        <div className="grid grid-cols-3 gap-2">
          {keyStats.map((s) => (
            <StatBox
              key={s.label}
              label={s.label}
              value={s.value}
              highlight={s.highlight}
            />
          ))}
        </div>
      </PanelSection>

      {/* Technical Indicators */}
      {technicals.length > 0 && (
        <PanelSection title="Technical Indicators">
          <div className="grid grid-cols-3 gap-2">
            {technicals.map((t) => (
              <StatBox
                key={t.label}
                label={t.label}
                value={t.value}
                highlight={t.highlight}
              />
            ))}
          </div>
        </PanelSection>
      )}

      {/* About */}
      {(description || aboutFields.length > 0) && (
        <PanelSection title={`About ${instrument.name}`}>
          {description && (
            <div className="mb-4">
              <p
                className={cn(
                  "text-xs leading-relaxed text-muted-foreground",
                  !descExpanded && "line-clamp-3",
                )}
              >
                {description}
              </p>
              <button
                type="button"
                onClick={() => setDescExpanded((v) => !v)}
                className="mt-1 cursor-pointer text-[11px] text-primary hover:underline"
              >
                {descExpanded ? "Show less" : "View more"}
              </button>
            </div>
          )}
          <div className="grid grid-cols-2 gap-x-4 gap-y-3">
            {aboutFields.map(({ label, value }) =>
              label === "Website" ? (
                <div key={label} className="flex flex-col gap-0.5">
                  <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    {label}
                  </span>
                  <a
                    href={value}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="truncate text-xs text-primary hover:underline"
                  >
                    {value.replace(/^https?:\/\//, "")}
                  </a>
                </div>
              ) : (
                <div key={label} className="flex flex-col gap-0.5">
                  <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    {label}
                  </span>
                  <span className="truncate text-xs font-medium">{value}</span>
                </div>
              ),
            )}
          </div>
        </PanelSection>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// OhlcvChart — Perplexity Finance-style price history chart
// ---------------------------------------------------------------------------

function OhlcvChart({
  instrumentId,
  ticker,
  currency,
}: {
  instrumentId: string;
  ticker: string;
  currency: string;
}) {
  const [timeRange, setTimeRange] = useState<TimeRange>("3M");
  const [hoveredClose, setHoveredClose] = useState<number | null>(null);
  const [hoveredDate, setHoveredDate] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const rangeDays = TIME_RANGES.find((r) => r.value === timeRange)?.days ?? 90;
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - rangeDays);
  const startDateStr = startDate.toISOString().split("T")[0] as string;
  const endDateStr = endDate.toISOString().split("T")[0] as string;

  const { data: candles = [], isLoading } = useQuery(
    ohlcvQueryOptions({
      instrumentId,
      timeframe: "1d",
      startDate: startDateStr,
      endDate: endDateStr,
      limit: 1000,
    }),
  );

  const { mutate: sync, isPending: isSyncing } = useMutation({
    ...syncOhlcvMutationOptions(),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["ohlcv"] });
      toast.success(
        `Synced ${result.synced} candle${result.synced !== 1 ? "s" : ""} for ${ticker}`,
      );
    },
    onError: (err: Error) => toast.error(`Sync failed: ${err.message}`),
  });

  function handleSync() {
    sync({
      instrumentId,
      timeframe: "1d",
      startDate: startDateStr,
      endDate: endDateStr,
    });
  }

  const chartData = candles.map((c) => ({
    date: new Date(c.timestamp).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    }),
    close: c.close,
    open: c.open,
    high: c.high,
    low: c.low,
  }));

  const startPrice = chartData.at(0)?.close ?? null;
  const latestPrice = chartData.at(-1)?.close ?? null;
  const periodHigh = chartData.length
    ? Math.max(...chartData.map((d) => d.high ?? d.close))
    : null;
  const periodLow = chartData.length
    ? Math.min(...chartData.map((d) => d.low ?? d.close))
    : null;

  const displayPrice = hoveredClose ?? latestPrice;
  const change =
    displayPrice != null && startPrice != null
      ? displayPrice - startPrice
      : null;
  const changePct =
    change != null && startPrice ? (change / startPrice) * 100 : null;
  const isPositive = change != null ? change >= 0 : true;
  const strokeColor = isPositive ? "#22c55e" : "#f43f5e";
  const gradId = `ohlcv-grad-${instrumentId.slice(0, 8)}`;

  if (isLoading) {
    return (
      <div className="flex h-full flex-col gap-3 p-4">
        <div className="flex items-baseline gap-4">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-5 w-24" />
        </div>
        <div className="flex gap-1">
          {TIME_RANGES.map((r) => (
            <Skeleton key={r.value} className="h-7 w-9 rounded-md" />
          ))}
        </div>
        <Skeleton className="flex-1 w-full rounded-md" />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col pt-3 pb-2">
      {/* ── Stats header ── */}
      <div className="flex items-start justify-between px-4 mb-2 flex-shrink-0">
        {/* Left: price + change */}
        <div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-bold tracking-tight tabular-nums font-mono">
              {displayPrice != null ? formatCompactPrice(displayPrice) : "—"}
            </span>
            <span className="text-xs text-muted-foreground font-mono">
              {currency}
            </span>
          </div>
          {change != null && changePct != null && (
            <div
              className={cn(
                "flex items-center gap-1 text-sm font-medium tabular-nums mt-0.5",
                isPositive ? "text-emerald-500" : "text-rose-500",
              )}
            >
              {isPositive ? (
                <IconTrendingUp className="h-3.5 w-3.5" />
              ) : (
                <IconTrendingDown className="h-3.5 w-3.5" />
              )}
              {isPositive ? "+" : ""}
              {formatCompactPrice(Math.abs(change))} ({isPositive ? "+" : ""}
              {changePct.toFixed(2)}%)
              <span className="text-xs text-muted-foreground font-normal ml-0.5">
                {hoveredDate ?? timeRange}
              </span>
            </div>
          )}
        </div>

        {/* Right: H/L + time range pills + sync */}
        <div className="flex flex-col items-end gap-1.5">
          {periodHigh != null && periodLow != null && (
            <div className="text-[11px] text-muted-foreground font-mono tabular-nums">
              <span className="text-muted-foreground/60">H </span>
              {formatCompactPrice(periodHigh)}
              <span className="mx-1.5 text-muted-foreground/30">·</span>
              <span className="text-muted-foreground/60">L </span>
              {formatCompactPrice(periodLow)}
            </div>
          )}
          <div className="flex items-center gap-1">
            <div className="flex items-center gap-0.5 rounded-md bg-muted/50 p-0.5">
              {TIME_RANGES.map((r) => (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => setTimeRange(r.value)}
                  className={cn(
                    "px-2 py-0.5 text-[11px] font-medium rounded transition-colors cursor-pointer",
                    timeRange === r.value
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {r.value}
                </button>
              ))}
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleSync}
              disabled={isSyncing}
              className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
              title="Sync price data"
            >
              <IconRefresh
                className={cn("h-3.5 w-3.5", isSyncing && "animate-spin")}
              />
            </Button>
          </div>
        </div>
      </div>

      {/* ── Chart or empty state ── */}
      {chartData.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-4 p-8 h-full text-center text-muted-foreground">
          <div className="rounded-full bg-muted p-5">
            <IconChartCandle className="h-7 w-7 opacity-40" />
          </div>
          <div>
            <p className="font-medium text-foreground">No price history</p>
            <p className="mt-1 text-sm">Sync data to display the chart.</p>
          </div>
          <Button
            size="sm"
            variant="secondary"
            onClick={handleSync}
            disabled={isSyncing}
            className="gap-2"
          >
            <IconRefresh
              className={cn("h-3.5 w-3.5", isSyncing && "animate-spin")}
            />
            {isSyncing ? "Syncing…" : `Sync ${ticker}`}
          </Button>
        </div>
      ) : (
        <div className="flex-1 min-h-0 px-2">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={chartData}
              margin={{ top: 4, right: 0, left: 0, bottom: 0 }}
              onMouseMove={(state) => {
                if (state.isTooltipActive && state.activePayload?.[0]) {
                  const pt = state.activePayload[0].payload;
                  setHoveredClose(pt.close);
                  setHoveredDate(pt.date);
                }
              }}
              onMouseLeave={() => {
                setHoveredClose(null);
                setHoveredDate(null);
              }}
            >
              <defs>
                <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="0%"
                    stopColor={strokeColor}
                    stopOpacity={0.35}
                  />
                  <stop
                    offset="70%"
                    stopColor={strokeColor}
                    stopOpacity={0.08}
                  />
                  <stop offset="100%" stopColor={strokeColor} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Tooltip
                cursor={{
                  stroke: "hsl(var(--muted-foreground))",
                  strokeWidth: 1,
                  strokeDasharray: "3 3",
                  strokeOpacity: 0.5,
                }}
                isAnimationActive={false}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const pt = payload[0]?.payload;
                  if (!pt) return null;
                  return (
                    <div className="rounded-lg border border-border/50 bg-card/95 px-3 py-2 text-card-foreground shadow-lg backdrop-blur-sm">
                      <p className="text-[11px] text-muted-foreground font-mono">
                        {pt.date}
                      </p>
                      <p className="text-sm font-bold tabular-nums font-mono">
                        {formatCompactPrice(pt.close)}
                      </p>
                      {pt.open != null && (
                        <div className="mt-1 flex gap-2 text-[10px] text-muted-foreground tabular-nums font-mono">
                          <span>O {formatCompactPrice(pt.open)}</span>
                          <span>H {formatCompactPrice(pt.high)}</span>
                          <span>L {formatCompactPrice(pt.low)}</span>
                        </div>
                      )}
                    </div>
                  );
                }}
              />
              <Area
                type="monotone"
                dataKey="close"
                stroke={strokeColor}
                strokeWidth={2}
                fill={`url(#${gradId})`}
                dot={false}
                activeDot={{
                  r: 4,
                  fill: strokeColor,
                  stroke: "hsl(var(--background))",
                  strokeWidth: 2,
                }}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ChartPanel — full-height panel: empty state or selected instrument
// ---------------------------------------------------------------------------

function ChartPanel({ instrument }: { instrument: Instrument | null }) {
  const [activeTab, setActiveTab] = useState<ChartTab>("live");

  if (!instrument) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center text-muted-foreground">
        <div className="rounded-full bg-muted p-6">
          <IconTelescope className="h-8 w-8 opacity-30" />
        </div>
        <div>
          <p className="font-medium text-foreground">Select an instrument</p>
          <p className="mt-1 text-sm">
            Click any row in the watchlist to view its chart
          </p>
        </div>
      </div>
    );
  }

  if (!instrument.id) return null;

  const tvSymbol = toTradingViewSymbol(instrument.ticker, instrument.exchange);

  const tabs: { id: ChartTab; label: string; icon: React.ReactNode }[] = [
    {
      id: "live",
      label: "Live Chart",
      icon: <IconChartLine className="h-3.5 w-3.5" />,
    },
    {
      id: "history",
      label: "Price History",
      icon: <IconChartCandle className="h-3.5 w-3.5" />,
    },
  ];

  const config = CLASS_CONFIG[instrument.assetClass] ?? DEFAULT_CLASS_CONFIG;

  return (
    <div className="flex flex-1 flex-col min-h-0">
      {/* Panel header */}
      <div className="flex items-center justify-between border-b px-4 py-3 flex-shrink-0">
        <div className="flex items-center gap-3">
          <span
            className={cn("h-2 w-2 rounded-full flex-shrink-0", config.dot)}
          />
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono font-bold text-base leading-none">
                {instrument.ticker}
              </span>
              <AssetClassBadge cls={instrument.assetClass} />
            </div>
            {instrument.name && (
              <p className="mt-0.5 text-xs text-muted-foreground leading-none">
                {instrument.name}
                {instrument.exchange && (
                  <span className="ml-1.5 text-muted-foreground/60">
                    · {instrument.exchange}
                  </span>
                )}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Tab switcher */}
          <div className="flex items-center rounded-lg border bg-muted/40 p-0.5">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-all cursor-pointer",
                  activeTab === tab.id
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Chart + details — vertical resizable */}
      <ResizablePanelGroup orientation="vertical" className="flex-1 min-h-0">
        <ResizablePanel defaultSize="55%" minSize="25%">
          <div className="h-full overflow-hidden">
            {activeTab === "live" ? (
              <TradingViewChart
                symbol={tvSymbol}
                height="100%"
                theme="dark"
                className="rounded-none border-0 shadow-none h-full"
              />
            ) : (
              <OhlcvChart
                instrumentId={instrument.id}
                ticker={instrument.ticker}
                currency={instrument.currency}
              />
            )}
          </div>
        </ResizablePanel>

        <ResizableHandle withHandle />

        <ResizablePanel defaultSize="45%" minSize="20%">
          <div className="h-full overflow-y-auto">
            <AssetInfoPanel instrument={instrument} />
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}

// ---------------------------------------------------------------------------
// InstrumentBrowser — main export
// ---------------------------------------------------------------------------

export function InstrumentBrowser() {
  const [search, setSearch] = useState("");
  const [assetClass, setAssetClass] = useState("");
  const [page, setPage] = useState(1);
  const [selectedInstrument, setSelectedInstrument] =
    useState<Instrument | null>(null);
  const [instrumentToDelete, setInstrumentToDelete] =
    useState<Instrument | null>(null);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery(
    instrumentsQueryOptions({
      page,
      limit: 20,
      search: search || undefined,
      assetClass: assetClass || undefined,
    }),
  );

  const { mutate: deleteInstrument, isPending: isDeleting } = useMutation({
    ...deleteInstrumentMutationOptions(),
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: ["instruments"] });
      if (selectedInstrument?.id === id) setSelectedInstrument(null);
      setInstrumentToDelete(null);
      toast.success("Instrument removed");
    },
    onError: (err: Error) => {
      toast.error(`Delete failed: ${err.message}`);
      setInstrumentToDelete(null);
    },
  });

  const instruments = data?.instruments ?? [];
  const totalPages = data?.pagination?.total_pages ?? 1;
  const total = data?.pagination?.total ?? 0;

  const instrumentIds = instruments
    .map((i) => i.id)
    .filter((id): id is string => !!id);
  const { data: prices } = useQuery(latestPricesQueryOptions(instrumentIds));

  function handleSearchChange(val: string) {
    setSearch(val);
    setPage(1);
    setSelectedInstrument(null);
  }

  function handleClassChange(val: string) {
    setAssetClass(val);
    setPage(1);
    setSelectedInstrument(null);
  }

  function handleSelect(instrument: Instrument) {
    setSelectedInstrument(
      selectedInstrument?.id === instrument.id ? null : instrument,
    );
  }

  function handleRequestDelete(instrument: Instrument) {
    setInstrumentToDelete(instrument);
  }

  return (
    <>
      {/* Full-height resizable split layout — watchlist left, chart right */}
      <ResizablePanelGroup className="h-full min-h-[600px] overflow-hidden rounded-md border">
        {/* ── Left: Watchlist panel ── */}
        <ResizablePanel defaultSize="28%" minSize="20%" maxSize="45%">
          <div className="flex h-full flex-col border-r bg-background">
            {/* Sticky header: title + add button */}
            <div className="flex-shrink-0 flex items-center justify-between border-b px-3 py-2">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Watchlist
              </span>
              <InstrumentDialogForm
                existingTickers={
                  new Set(instruments.map((i) => i.ticker.toUpperCase()))
                }
              />
            </div>

            {/* Sticky header: search + filters */}
            <div className="flex-shrink-0 space-y-2 border-b p-3">
              {/* Search */}
              <div className="relative">
                <IconSearch className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search ticker or name…"
                  value={search}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  className="h-8 pl-8 pr-8 text-xs"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => handleSearchChange("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                  >
                    <IconX className="h-3 w-3" />
                  </button>
                )}
              </div>

              {/* Asset class filter chips */}
              <div className="flex flex-wrap gap-1">
                {ASSET_CLASSES.map(({ value, label }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => handleClassChange(value)}
                    className={cn(
                      "rounded-full border px-2 py-0.5 text-[11px] font-medium transition-colors cursor-pointer",
                      assetClass === value
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground",
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Instrument count */}
            {!isLoading && (
              <div className="flex-shrink-0 border-b px-3 py-1.5">
                <p className="text-[11px] text-muted-foreground">
                  <span className="font-semibold text-foreground">{total}</span>{" "}
                  instrument{total !== 1 ? "s" : ""}
                </p>
              </div>
            )}

            {/* Scrollable list */}
            <div className="flex-1 overflow-y-auto">
              {isLoading ? (
                <div className="space-y-px p-2">
                  {Array.from({ length: 8 }).map((_, i) => (
                    // biome-ignore lint/suspicious/noArrayIndexKey: skeleton
                    <Skeleton key={i} className="h-11 w-full rounded-md" />
                  ))}
                </div>
              ) : instruments.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-3 py-12 text-center text-muted-foreground px-4">
                  <div className="rounded-full bg-muted p-3">
                    <IconTelescope className="h-5 w-5 opacity-40" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      No instruments
                    </p>
                    <p className="mt-0.5 text-xs">
                      {search || assetClass
                        ? "Try adjusting filters"
                        : "Register via the API"}
                    </p>
                  </div>
                </div>
              ) : (
                instruments.map((instrument) => (
                  <WatchlistRow
                    key={instrument.id}
                    instrument={instrument}
                    selected={selectedInstrument?.id === instrument.id}
                    price={
                      instrument.id ? (prices?.[instrument.id] ?? null) : null
                    }
                    onClick={() => handleSelect(instrument)}
                    onDelete={() => handleRequestDelete(instrument)}
                  />
                ))
              )}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex-shrink-0 flex items-center justify-between border-t px-3 py-2">
                <button
                  type="button"
                  disabled={page === 1}
                  onClick={() => setPage((p) => p - 1)}
                  className={cn(
                    "flex h-7 w-7 items-center justify-center rounded-md border transition-colors cursor-pointer",
                    page === 1
                      ? "border-border/40 text-muted-foreground/40 cursor-not-allowed"
                      : "border-border text-foreground hover:bg-muted",
                  )}
                >
                  <IconChevronLeft className="h-3.5 w-3.5" />
                </button>
                <span className="text-xs text-muted-foreground">
                  {page} / {totalPages}
                </span>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className={cn(
                    "flex h-7 w-7 items-center justify-center rounded-md border transition-colors cursor-pointer",
                    page >= totalPages
                      ? "border-border/40 text-muted-foreground/40 cursor-not-allowed"
                      : "border-border text-foreground hover:bg-muted",
                  )}
                >
                  <IconChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* ── Right: Chart panel ── */}
        <ResizablePanel defaultSize="72%" minSize="55%">
          <div className="flex h-full flex-col overflow-hidden">
            <ChartPanel instrument={selectedInstrument} />
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>

      {/* ── Delete confirmation dialog ── */}
      <AlertDialog
        open={instrumentToDelete !== null}
        onOpenChange={(open) => !open && setInstrumentToDelete(null)}
      >
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogMedia className="bg-rose-500/10 text-rose-500">
              <IconTrash />
            </AlertDialogMedia>
            <AlertDialogTitle>
              Remove {instrumentToDelete?.ticker}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {instrumentToDelete?.name && (
                <span className="font-medium text-foreground">
                  {instrumentToDelete.name}
                </span>
              )}{" "}
              will be removed from the registry. All associated OHLCV data will
              also be deleted. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={isDeleting}
              onClick={() => {
                if (instrumentToDelete?.id) {
                  deleteInstrument(instrumentToDelete.id);
                }
              }}
            >
              {isDeleting ? "Removing…" : "Remove"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
