"use client";

import {
  instrumentsQueryOptions,
  ohlcvQueryOptions,
  syncOhlcvMutationOptions,
} from "@repo/common/lib/query/instrument-query";
import type { Instrument } from "@repo/common/types/investment";
import { Button } from "@repo/ui/components/button";
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
  IconX,
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";
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
  onClick,
}: {
  instrument: Instrument;
  selected: boolean;
  onClick: () => void;
}) {
  const config = CLASS_CONFIG[instrument.assetClass] ?? DEFAULT_CLASS_CONFIG;

  return (
    <button
      type="button"
      onClick={onClick}
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

      {/* Exchange + Currency */}
      <div className="flex-shrink-0 text-right">
        <p className="font-mono text-xs leading-none">{instrument.currency}</p>
        <p className="mt-0.5 text-[10px] text-muted-foreground leading-none">
          {instrument.exchange ?? "—"}
        </p>
      </div>

      {/* Chevron indicator */}
      <IconChevronRight
        className={cn(
          "h-3.5 w-3.5 flex-shrink-0 text-muted-foreground/50 transition-transform",
          selected && "text-primary rotate-90",
        )}
      />
    </button>
  );
}

// ---------------------------------------------------------------------------
// OhlcvChart — price history area chart (chart area only)
// ---------------------------------------------------------------------------

function OhlcvChart({
  instrumentId,
  ticker,
  onSync,
  isSyncing,
}: {
  instrumentId: string;
  ticker: string;
  onSync: () => void;
  isSyncing: boolean;
}) {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 90);

  const { data: candles = [], isLoading } = useQuery(
    ohlcvQueryOptions({
      instrumentId,
      timeframe: "1d",
      startDate: startDate.toISOString().split("T")[0] as string,
      endDate: endDate.toISOString().split("T")[0] as string,
      limit: 200,
    }),
  );

  const chartData = candles.map((c) => ({
    date: new Date(c.timestamp).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    }),
    close: c.close,
  }));

  const lastPrice = chartData.at(-1)?.close;
  const firstPrice = chartData.at(0)?.close;
  const isUp =
    lastPrice != null && firstPrice != null && lastPrice >= firstPrice;
  const strokeColor = isUp ? "#22c55e" : "#f43f5e";

  if (isLoading) {
    return (
      <div className="flex-1 p-6">
        <Skeleton className="h-full w-full min-h-[280px]" />
      </div>
    );
  }

  if (chartData.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center text-muted-foreground">
        <div className="rounded-full bg-muted p-5">
          <IconChartCandle className="h-7 w-7 opacity-40" />
        </div>
        <div>
          <p className="font-medium text-foreground">No price history</p>
          <p className="mt-1 text-sm">
            Fetch 90 days of daily candles from the market data provider.
          </p>
        </div>
        <Button
          size="sm"
          variant="secondary"
          onClick={onSync}
          disabled={isSyncing}
          className="gap-2"
        >
          <IconRefresh
            className={cn("h-3.5 w-3.5", isSyncing && "animate-spin")}
          />
          {isSyncing ? "Syncing…" : `Sync ${ticker}`}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex-1 p-4 min-h-0">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={chartData}
          margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
        >
          <defs>
            <linearGradient id="colorClose" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={strokeColor} stopOpacity={0.15} />
              <stop offset="95%" stopColor={strokeColor} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="hsl(var(--border))"
            opacity={0.5}
          />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
            tickLine={false}
            axisLine={false}
            width={65}
            tickFormatter={(v) => v.toLocaleString()}
          />
          <Tooltip
            contentStyle={{
              background: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "8px",
              fontSize: 12,
            }}
            formatter={(v: number) => [
              v.toLocaleString("en-US", { maximumFractionDigits: 6 }),
              "Close",
            ]}
          />
          <Area
            type="monotone"
            dataKey="close"
            stroke={strokeColor}
            strokeWidth={1.5}
            fill="url(#colorClose)"
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ChartPanel — full-height panel: empty state or selected instrument
// ---------------------------------------------------------------------------

function ChartPanel({ instrument }: { instrument: Instrument | null }) {
  const [activeTab, setActiveTab] = useState<ChartTab>("live");
  const queryClient = useQueryClient();

  // All hooks must be called unconditionally before any early returns
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 90);
  const startDateStr = startDate.toISOString().split("T")[0] as string;
  const endDateStr = endDate.toISOString().split("T")[0] as string;
  const instrumentId = instrument?.id ?? "";

  const { mutate: sync, isPending: isSyncing } = useMutation({
    ...syncOhlcvMutationOptions(),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["ohlcv"] });
      toast.success(
        `Synced ${result.synced} candle${result.synced !== 1 ? "s" : ""} for ${instrument?.ticker ?? ""}`,
      );
    },
    onError: (err: Error) => toast.error(`Sync failed: ${err.message}`),
  });

  function handleSync() {
    if (!instrumentId) return;
    sync({
      instrumentId,
      timeframe: "1d",
      startDate: startDateStr,
      endDate: endDateStr,
    });
  }

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
          {activeTab === "history" && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleSync}
              disabled={isSyncing}
              className="h-7 gap-1.5 px-2.5 text-xs"
            >
              <IconRefresh
                className={cn("h-3 w-3", isSyncing && "animate-spin")}
              />
              {isSyncing ? "Syncing…" : "Sync"}
            </Button>
          )}

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

      {/* Chart area — fills remaining height */}
      {activeTab === "live" ? (
        <TradingViewChart
          symbol={tvSymbol}
          height={420}
          theme="dark"
          className="rounded-none border-0 shadow-none flex-1"
        />
      ) : (
        <OhlcvChart
          instrumentId={instrumentId}
          ticker={instrument.ticker}
          onSync={handleSync}
          isSyncing={isSyncing}
        />
      )}
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

  const { data, isLoading } = useQuery(
    instrumentsQueryOptions({
      page,
      limit: 20,
      search: search || undefined,
      assetClass: assetClass || undefined,
    }),
  );

  const instruments = data?.instruments ?? [];
  const totalPages = data?.pagination?.total_pages ?? 1;
  const total = data?.pagination?.total ?? 0;

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

  return (
    // Full-height resizable split layout — watchlist left, chart right
    <ResizablePanelGroup className="h-full min-h-[600px] overflow-hidden rounded-md border">
      {/* ── Left: Watchlist panel ── */}
      <ResizablePanel defaultSize="28%" minSize="20%" maxSize="45%">
        <div className="flex h-full flex-col border-r bg-background">
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
                  onClick={() => handleSelect(instrument)}
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
  );
}
