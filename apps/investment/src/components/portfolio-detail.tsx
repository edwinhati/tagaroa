"use client";

import { instrumentsQueryOptions } from "@repo/common/lib/query/instrument-query";
import {
  allocationQueryOptions,
  cashFlowsQueryOptions,
  computeNavQueryOptions,
  correlationMatrixQueryOptions,
  performanceQueryOptions,
  portfolioQueryOptions,
  positionsWithPnlQueryOptions,
  tradesQueryOptions,
  useAddPositionMutationOptions,
  useAutoSnapshotMutationOptions,
  useClosePositionMutationOptions,
  useDeleteCashFlowMutationOptions,
  useRecordCashFlowMutationOptions,
  useRecordSnapshotMutationOptions,
} from "@repo/common/lib/query/portfolio-query";
import type {
  CashFlow,
  PerformanceMetrics,
  PositionWithPnl,
  Trade,
} from "@repo/common/types/investment";
import { Button } from "@repo/ui/components/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@repo/ui/components/dialog";
import { Input } from "@repo/ui/components/input";
import { Label } from "@repo/ui/components/label";
import { Progress } from "@repo/ui/components/progress";
import { Skeleton } from "@repo/ui/components/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/ui/components/table";
import { cn } from "@repo/ui/lib/utils";
import {
  IconArrowDownRight,
  IconArrowUpRight,
  IconCircleFilled,
  IconFolderX,
  IconPlus,
  IconTrash,
  IconX,
} from "@tabler/icons-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CorrelationHeatmap } from "./correlation-heatmap";
import { NavChart } from "./nav-chart";

interface PortfolioDetailProps {
  readonly portfolioId: string;
}

const MODE_CONFIG = {
  live: {
    label: "Live",
    bg: "bg-emerald-500/10",
    text: "text-emerald-600 dark:text-emerald-400",
    border: "border-emerald-500/20",
    dot: "bg-emerald-500",
  },
  paper: {
    label: "Paper",
    bg: "bg-amber-500/10",
    text: "text-amber-600 dark:text-amber-400",
    border: "border-amber-500/20",
    dot: "bg-amber-500",
  },
  backtest: {
    label: "Backtest",
    bg: "bg-blue-500/10",
    text: "text-blue-600 dark:text-blue-400",
    border: "border-blue-500/20",
    dot: "bg-blue-500",
  },
} as const;

// ─── Add Position Dialog ──────────────────────────────────────────────────────

interface AddPositionDialogProps {
  readonly portfolioId: string;
}

function AddPositionDialog({ portfolioId }: AddPositionDialogProps) {
  const [open, setOpen] = useState(false);
  const [instrumentId, setInstrumentId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [averageCost, setAverageCost] = useState("");
  const [side, setSide] = useState<"LONG" | "SHORT">("LONG");
  const [openedAt, setOpenedAt] = useState(
    () => new Date().toISOString().slice(0, 16), // "YYYY-MM-DDTHH:mm"
  );
  const [instrumentSearch, setInstrumentSearch] = useState("");

  const { data: instrumentsData } = useQuery(
    instrumentsQueryOptions({
      search: instrumentSearch || undefined,
      limit: 20,
    }),
  );
  const instruments = instrumentsData?.instruments ?? [];

  const addPositionMutationOpts = useAddPositionMutationOptions(portfolioId);
  const { mutate, isPending } = useMutation({
    ...addPositionMutationOpts,
    onSuccess: () => {
      setOpen(false);
      resetForm();
      toast.success("Position opened");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  function resetForm() {
    setInstrumentId("");
    setQuantity("");
    setAverageCost("");
    setSide("LONG");
    setOpenedAt(new Date().toISOString().slice(0, 16));
    setInstrumentSearch("");
  }

  const selectedInstrument = instruments.find((i) => i.id === instrumentId);

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) resetForm();
      }}
    >
      <DialogTrigger
        render={<Button size="sm" className="gap-1.5" type="button" />}
      >
        <IconPlus className="h-4 w-4" />
        Open Position
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Open Position</DialogTitle>
        </DialogHeader>

        <form
          className="flex flex-col gap-5 pt-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!instrumentId) {
              toast.error("Select an instrument");
              return;
            }
            mutate({
              instrumentId,
              quantity: Number(quantity),
              averageCost: Number(averageCost),
              side,
              openedAt: new Date(openedAt).toISOString(),
            });
          }}
        >
          {/* Instrument picker */}
          <div className="flex flex-col gap-1.5">
            <Label>Instrument</Label>
            <Input
              placeholder="Search ticker or name…"
              value={instrumentSearch}
              onChange={(e) => {
                setInstrumentSearch(e.target.value);
                setInstrumentId(""); // clear selection when searching
              }}
            />
            {/* Dropdown list */}
            {instrumentSearch && !selectedInstrument && (
              <div className="rounded-lg border bg-card shadow-sm">
                {instruments.length === 0 ? (
                  <p className="px-3 py-2 text-sm text-muted-foreground">
                    No instruments found
                  </p>
                ) : (
                  <ul className="max-h-40 overflow-y-auto py-1">
                    {instruments.map((inst) => (
                      <li key={inst.id}>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-muted cursor-pointer"
                          onClick={() => {
                            setInstrumentId(inst.id ?? "");
                            setInstrumentSearch(inst.ticker);
                          }}
                        >
                          <span className="font-mono font-semibold">
                            {inst.ticker}
                          </span>
                          <span className="truncate text-muted-foreground">
                            {inst.name}
                          </span>
                          <span className="ml-auto shrink-0 rounded border px-1.5 py-0.5 text-xs text-muted-foreground">
                            {inst.assetClass}
                          </span>
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
            {/* Selected instrument pill */}
            {selectedInstrument && (
              <div className="flex items-center gap-2 rounded-lg border bg-muted/50 px-3 py-2">
                <span className="font-mono font-semibold">
                  {selectedInstrument.ticker}
                </span>
                <span className="text-sm text-muted-foreground">
                  {selectedInstrument.name}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="ml-auto text-muted-foreground hover:text-foreground cursor-pointer"
                  onClick={() => {
                    setInstrumentId("");
                    setInstrumentSearch("");
                  }}
                >
                  <IconX className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
          </div>

          {/* Side */}
          <div className="flex flex-col gap-1.5">
            <Label>Side</Label>
            <div className="grid grid-cols-2 gap-2">
              {(["LONG", "SHORT"] as const).map((s) => {
                const isActive = side === s;
                const activeStyles =
                  s === "LONG"
                    ? "border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                    : "border-rose-500 bg-rose-500/10 text-rose-600 dark:text-rose-400";

                return (
                  <Button
                    key={s}
                    type="button"
                    variant="ghost"
                    onClick={() => setSide(s)}
                    className={cn(
                      "flex items-center justify-center gap-2 rounded-lg border py-2.5 text-sm font-medium transition-colors cursor-pointer",
                      isActive
                        ? activeStyles
                        : "border-border text-muted-foreground hover:bg-muted",
                    )}
                  >
                    {s === "LONG" ? (
                      <IconArrowUpRight className="h-4 w-4" />
                    ) : (
                      <IconArrowDownRight className="h-4 w-4" />
                    )}
                    {s}
                  </Button>
                );
              })}
            </div>
          </div>

          {/* Quantity + Avg Cost */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="pos-qty">Quantity</Label>
              <Input
                id="pos-qty"
                type="number"
                min="0"
                step="any"
                placeholder="0.00"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="font-mono tabular-nums"
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="pos-cost">Avg Cost</Label>
              <Input
                id="pos-cost"
                type="number"
                min="0"
                step="any"
                placeholder="0.00"
                value={averageCost}
                onChange={(e) => setAverageCost(e.target.value)}
                className="font-mono tabular-nums"
                required
              />
            </div>
          </div>

          {/* Cost basis preview */}
          {quantity && averageCost && (
            <div className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2 text-sm">
              <span className="text-muted-foreground">Cost basis</span>
              <span className="font-mono font-semibold tabular-nums">
                {(Number(quantity) * Number(averageCost)).toLocaleString(
                  "en-US",
                  {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 6,
                  },
                )}
              </span>
            </div>
          )}

          {/* Opened at */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="pos-opened">Opened at</Label>
            <Input
              id="pos-opened"
              type="datetime-local"
              value={openedAt}
              onChange={(e) => setOpenedAt(e.target.value)}
              required
            />
          </div>

          <Button
            type="submit"
            disabled={isPending || !instrumentId}
            className="mt-1"
          >
            {isPending ? "Opening…" : "Open Position"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Record Snapshot Dialog ───────────────────────────────────────────────────

interface RecordSnapshotDialogProps {
  readonly portfolioId: string;
  readonly initialCapital: number;
  readonly currency: string;
}

function RecordSnapshotDialog({
  portfolioId,
  initialCapital,
  currency,
}: RecordSnapshotDialogProps) {
  const [open, setOpen] = useState(false);
  const [nav, setNav] = useState(String(initialCapital));
  const [cash, setCash] = useState(String(initialCapital));

  const { data: navData, isLoading: navLoading } = useQuery({
    ...computeNavQueryOptions(portfolioId),
    enabled: open,
  });

  // Pre-fill fields when computed NAV arrives
  useEffect(() => {
    if (open && navData) {
      setNav(navData.nav.toFixed(2));
      setCash(navData.cash.toFixed(2));
    }
  }, [open, navData]);

  const recordSnapshotMutationOpts =
    useRecordSnapshotMutationOptions(portfolioId);
  const { mutate, isPending } = useMutation({
    ...recordSnapshotMutationOpts,
    onSuccess: () => {
      setOpen(false);
      toast.success("Snapshot recorded");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  function handleOpenChange(v: boolean) {
    setOpen(v);
    if (!v) {
      setNav(String(initialCapital));
      setCash(String(initialCapital));
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={<Button size="sm" variant="outline" type="button" />}
      >
        Record Snapshot
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Record NAV Snapshot</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground -mt-2">
          NAV is computed from open positions × latest prices. You can edit
          before confirming.
        </p>

        {/* Breakdown table */}
        {navLoading && (
          <div className="flex items-center gap-2 rounded-lg border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
            <span className="animate-pulse">Computing live NAV…</span>
          </div>
        )}
        {navData && navData.breakdown.length > 0 && (
          <div className="rounded-lg border overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="px-3 py-2 text-left font-medium uppercase tracking-wider text-muted-foreground">
                    Ticker
                  </th>
                  <th className="px-3 py-2 text-left font-medium uppercase tracking-wider text-muted-foreground">
                    Side
                  </th>
                  <th className="px-3 py-2 text-right font-medium uppercase tracking-wider text-muted-foreground">
                    Qty
                  </th>
                  <th className="px-3 py-2 text-right font-medium uppercase tracking-wider text-muted-foreground">
                    Price
                  </th>
                  <th className="px-3 py-2 text-right font-medium uppercase tracking-wider text-muted-foreground">
                    Value
                  </th>
                  <th className="px-3 py-2 text-right font-medium uppercase tracking-wider text-muted-foreground">
                    Source
                  </th>
                </tr>
              </thead>
              <tbody>
                {navData.breakdown.map((item) => (
                  <tr
                    key={item.ticker}
                    className="border-b last:border-0 hover:bg-muted/20"
                  >
                    <td className="px-3 py-2 font-mono font-semibold">
                      {item.ticker}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={cn(
                          "rounded border px-1.5 py-0.5 text-xs font-medium",
                          item.side === "LONG"
                            ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                            : "border-rose-500/20 bg-rose-500/10 text-rose-600 dark:text-rose-400",
                        )}
                      >
                        {item.side}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums">
                      {item.quantity}
                    </td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums">
                      {item.price.toLocaleString("en-US", {
                        maximumFractionDigits: 6,
                      })}
                    </td>
                    <td
                      className={cn(
                        "px-3 py-2 text-right font-mono tabular-nums font-medium",
                        item.value >= 0
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-rose-600 dark:text-rose-400",
                      )}
                    >
                      {item.value.toLocaleString("en-US", {
                        maximumFractionDigits: 2,
                      })}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <span
                        className={cn(
                          "rounded border px-1.5 py-0.5 text-xs",
                          item.isFallback
                            ? "border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400"
                            : "border-border text-muted-foreground",
                        )}
                      >
                        {item.isFallback ? "cost" : "OHLCV"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <form
          className="flex flex-col gap-4 pt-1"
          onSubmit={(e) => {
            e.preventDefault();
            mutate({ nav: Number(nav), cash: Number(cash) });
          }}
        >
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="snap-nav">NAV ({currency})</Label>
              <Input
                id="snap-nav"
                type="number"
                min="0"
                step="any"
                value={nav}
                onChange={(e) => setNav(e.target.value)}
                className="font-mono tabular-nums"
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="snap-cash">Cash ({currency})</Label>
              <Input
                id="snap-cash"
                type="number"
                min="0"
                step="any"
                value={cash}
                onChange={(e) => setCash(e.target.value)}
                className="font-mono tabular-nums"
                required
              />
            </div>
          </div>
          <Button type="submit" disabled={isPending}>
            {isPending ? "Recording…" : "Record Snapshot"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Auto Snapshot Button ─────────────────────────────────────────────────────

interface AutoSnapshotButtonProps {
  readonly portfolioId: string;
  readonly currency: string;
}

function AutoSnapshotButton({
  portfolioId,
  currency,
}: AutoSnapshotButtonProps) {
  const autoSnapshotMutationOpts = useAutoSnapshotMutationOptions(portfolioId);
  const { mutate, isPending } = useMutation({
    ...autoSnapshotMutationOpts,
    onSuccess: (data) => {
      toast.success(
        `Snapshot recorded — NAV: ${currency} ${data.nav.toLocaleString("en-US", { maximumFractionDigits: 2 })}`,
      );
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <Button
      size="sm"
      variant="secondary"
      type="button"
      disabled={isPending}
      onClick={() => mutate()}
      className="gap-1.5"
    >
      {isPending ? "Computing…" : "Auto Snapshot"}
    </Button>
  );
}

// ─── Performance panel ────────────────────────────────────────────────────────

function ReturnValue({ pct }: Readonly<{ pct: number }>) {
  const isPositive = pct >= 0;
  const Icon = isPositive ? IconArrowUpRight : IconArrowDownRight;
  return (
    <div
      className={cn(
        "flex items-center gap-1 font-mono tabular-nums",
        isPositive
          ? "text-emerald-600 dark:text-emerald-400"
          : "text-rose-600 dark:text-rose-400",
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="text-2xl font-bold">
        {isPositive ? "+" : ""}
        {pct.toFixed(2)}%
      </span>
    </div>
  );
}

interface MetricCardProps {
  readonly label: string;
  readonly value: React.ReactNode;
  readonly sub?: string;
  readonly accent?: string;
}

function MetricCard({ label, value, sub, accent }: MetricCardProps) {
  return (
    <Card className="relative overflow-hidden">
      {accent && (
        <div className={cn("absolute inset-x-0 top-0 h-0.5", accent)} />
      )}
      <CardHeader className="pb-1 pt-4">
        <CardTitle className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent className="pb-4">
        <div className="flex flex-col gap-0.5">
          {value}
          {sub && <span className="text-xs text-muted-foreground">{sub}</span>}
        </div>
      </CardContent>
    </Card>
  );
}

interface NullableMetricProps {
  readonly value: number | null;
  readonly suffix?: string;
  readonly prefix?: string;
}

function NullableMetric({
  value,
  suffix = "",
  prefix = "",
}: NullableMetricProps) {
  if (value == null) {
    return (
      <span className="font-mono text-2xl font-bold tabular-nums text-muted-foreground">
        —
      </span>
    );
  }
  return (
    <span className="font-mono text-2xl font-bold tabular-nums">
      {prefix}
      {value.toFixed(2)}
      {suffix}
    </span>
  );
}

function SharpeValue({ value }: Readonly<{ value: number | null }>) {
  if (value == null) {
    return (
      <span className="font-mono text-2xl font-bold tabular-nums text-muted-foreground">
        —
      </span>
    );
  }
  let statusColor = "text-rose-600 dark:text-rose-400";
  if (value >= 1) {
    statusColor = "text-emerald-600 dark:text-emerald-400";
  } else if (value >= 0) {
    statusColor = "text-amber-600 dark:text-amber-400";
  }

  return (
    <span
      className={cn("font-mono text-2xl font-bold tabular-nums", statusColor)}
    >
      {value.toFixed(2)}
    </span>
  );
}

interface PerformancePanelProps {
  readonly metrics: PerformanceMetrics;
  readonly currency: string;
}

function PerformancePanel({ metrics, currency }: PerformancePanelProps) {
  const ddPct = Math.min(metrics.maxDrawdownPct, 100);
  return (
    <div className="flex flex-col gap-4">
      {/* Row 1: Returns */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Total Return"
          accent={metrics.totalReturn >= 0 ? "bg-emerald-500" : "bg-rose-500"}
          value={<ReturnValue pct={metrics.totalReturnPct} />}
          sub={`${currency} ${Math.abs(metrics.totalReturn).toLocaleString("en-US", { maximumFractionDigits: 2 })}`}
        />
        <MetricCard
          label="TWR"
          accent="bg-primary"
          value={<NullableMetric value={metrics.twr} suffix="%" />}
          sub="Time-weighted return"
        />
        <MetricCard
          label="CAGR"
          accent="bg-primary"
          value={<NullableMetric value={metrics.cagr} suffix="%" />}
          sub="Annualised growth rate"
        />
        <MetricCard
          label="Sharpe Ratio"
          accent="bg-primary"
          value={<SharpeValue value={metrics.sharpeRatio} />}
          sub="Risk-adjusted return"
        />
      </div>
      {/* Row 2: Risk */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Sortino Ratio"
          accent="bg-primary"
          value={<SharpeValue value={metrics.sortinoRatio} />}
          sub="Downside deviation adjusted"
        />
        <MetricCard
          label="Calmar Ratio"
          accent="bg-primary"
          value={<SharpeValue value={metrics.calmarRatio} />}
          sub="CAGR / max drawdown"
        />
        <MetricCard
          label="Max Drawdown"
          accent="bg-rose-500"
          value={
            <div className="flex flex-col gap-2">
              <span className="font-mono text-2xl font-bold tabular-nums text-rose-600 dark:text-rose-400">
                -{metrics.maxDrawdownPct.toFixed(2)}%
              </span>
              <Progress value={ddPct} className="h-1.5 [&>div]:bg-rose-500" />
            </div>
          }
        />
        <MetricCard
          label="Volatility"
          accent="bg-amber-500"
          value={<NullableMetric value={metrics.volatility} suffix="%" />}
          sub="Annualised"
        />
      </div>
      {/* Row 3: Distribution */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Win Rate"
          accent="bg-emerald-500"
          value={<NullableMetric value={metrics.winRate} suffix="%" />}
          sub="% of positive days"
        />
        <MetricCard
          label="Profit Factor"
          accent="bg-emerald-500"
          value={<NullableMetric value={metrics.profitFactor} />}
          sub="Gains / losses ratio"
        />
        <MetricCard
          label="VaR 95%"
          accent="bg-rose-500"
          value={<NullableMetric value={metrics.var95} suffix="%" prefix="-" />}
          sub="Daily value at risk"
        />
        <MetricCard
          label="CVaR 95%"
          accent="bg-rose-600"
          value={
            <NullableMetric value={metrics.cvar95} suffix="%" prefix="-" />
          }
          sub="Expected shortfall"
        />
      </div>
    </div>
  );
}

// ─── Close Position Dialog ────────────────────────────────────────────────────

interface ClosePositionDialogProps {
  readonly portfolioId: string;
  readonly positionId: string;
  readonly ticker?: string;
  readonly maxQty?: number;
}

function ClosePositionDialog({
  portfolioId,
  positionId,
  ticker,
  maxQty,
}: ClosePositionDialogProps) {
  const [open, setOpen] = useState(false);
  const [price, setPrice] = useState("");
  const [quantity, setQuantity] = useState("");
  const [fees, setFees] = useState("");

  const closePositionMutationOpts =
    useClosePositionMutationOptions(portfolioId);
  const { mutate, isPending } = useMutation({
    ...closePositionMutationOpts,
    onSuccess: () => {
      setOpen(false);
      setPrice("");
      setQuantity("");
      setFees("");
      toast.success("Position closed");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="invisible rounded-md border px-2 py-1 text-xs text-muted-foreground transition-colors hover:border-rose-500/30 hover:bg-rose-500/10 hover:text-rose-600 group-hover:visible cursor-pointer"
          />
        }
      >
        Close
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>
            Close Position{ticker ? ` — ${ticker}` : ""}
          </DialogTitle>
        </DialogHeader>
        <form
          className="flex flex-col gap-4 pt-1"
          onSubmit={(e) => {
            e.preventDefault();
            mutate({
              positionId,
              price: Number(price),
              quantity: quantity ? Number(quantity) : undefined,
              fees: fees ? Number(fees) : undefined,
            });
          }}
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="close-price">Close Price *</Label>
            <Input
              id="close-price"
              type="number"
              min="0"
              step="any"
              placeholder="0.00"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="font-mono tabular-nums"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="close-qty">
                Quantity{maxQty ? ` (max ${maxQty})` : " (optional)"}
              </Label>
              <Input
                id="close-qty"
                type="number"
                min="0"
                step="any"
                placeholder="Full close"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="font-mono tabular-nums"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="close-fees">Fees (optional)</Label>
              <Input
                id="close-fees"
                type="number"
                min="0"
                step="any"
                placeholder="0.00"
                value={fees}
                onChange={(e) => setFees(e.target.value)}
                className="font-mono tabular-nums"
              />
            </div>
          </div>
          <Button
            type="submit"
            disabled={isPending || !price}
            variant="destructive"
          >
            {isPending ? "Closing…" : "Close Position"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Position row ─────────────────────────────────────────────────────────────

interface PositionRowProps {
  readonly position: PositionWithPnl;
  readonly portfolioId: string;
}

function PositionRow({ position, portfolioId }: PositionRowProps) {
  const isLong = position.side === "LONG";
  const isUp = position.unrealizedPnl >= 0;

  return (
    <TableRow className="group transition-colors hover:bg-muted/40">
      <TableCell>
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-1.5">
            <span className="font-mono font-semibold">{position.ticker}</span>
            {position.isStale && (
              <span className="rounded border border-amber-500/20 bg-amber-500/10 px-1 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400">
                stale
              </span>
            )}
          </div>
          <span className="text-xs text-muted-foreground">
            {position.assetClass}
          </span>
        </div>
      </TableCell>
      <TableCell>
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium",
            isLong
              ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
              : "border-rose-500/20 bg-rose-500/10 text-rose-600 dark:text-rose-400",
          )}
        >
          {isLong ? (
            <IconArrowUpRight className="h-3 w-3" />
          ) : (
            <IconArrowDownRight className="h-3 w-3" />
          )}
          {position.side}
        </span>
      </TableCell>
      <TableCell className="text-right font-mono tabular-nums text-sm">
        {position.quantity.toLocaleString("en-US", {
          maximumFractionDigits: 6,
        })}
      </TableCell>
      <TableCell className="text-right font-mono tabular-nums text-sm">
        {position.averageCost.toLocaleString("en-US", {
          maximumFractionDigits: 4,
        })}
      </TableCell>
      <TableCell className="text-right font-mono tabular-nums text-sm">
        {position.currentPrice.toLocaleString("en-US", {
          maximumFractionDigits: 4,
        })}
      </TableCell>
      <TableCell className="text-right font-mono tabular-nums text-sm">
        {position.marketValue.toLocaleString("en-US", {
          maximumFractionDigits: 2,
        })}
      </TableCell>
      <TableCell className="text-right">
        <div className="flex flex-col items-end gap-0.5">
          <span
            className={cn(
              "font-mono tabular-nums text-sm font-medium",
              isUp
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-rose-600 dark:text-rose-400",
            )}
          >
            {isUp ? "+" : ""}
            {position.unrealizedPnl.toLocaleString("en-US", {
              maximumFractionDigits: 2,
            })}
          </span>
          <span
            className={cn(
              "text-xs",
              isUp
                ? "text-emerald-600/70 dark:text-emerald-400/70"
                : "text-rose-600/70 dark:text-rose-400/70",
            )}
          >
            {isUp ? "+" : ""}
            {position.unrealizedPnlPct.toFixed(2)}%
          </span>
        </div>
      </TableCell>
      <TableCell className="text-right text-xs text-muted-foreground">
        {(position.weight * 100).toFixed(1)}%
      </TableCell>
      <TableCell className="text-right">
        <ClosePositionDialog
          portfolioId={portfolioId}
          positionId={position.id ?? ""}
          ticker={position.ticker}
          maxQty={position.quantity}
        />
      </TableCell>
    </TableRow>
  );
}

// ─── Cash flow type badge ─────────────────────────────────────────────────────

const CF_TYPE_CONFIG = {
  DEPOSIT: {
    label: "Deposit",
    cls: "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  },
  WITHDRAWAL: {
    label: "Withdrawal",
    cls: "border-rose-500/20 bg-rose-500/10 text-rose-600 dark:text-rose-400",
  },
  DIVIDEND: {
    label: "Dividend",
    cls: "border-blue-500/20 bg-blue-500/10 text-blue-600 dark:text-blue-400",
  },
  FEE: {
    label: "Fee",
    cls: "border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400",
  },
} as const;

// ─── Record Cash Flow Dialog ──────────────────────────────────────────────────

interface RecordCashFlowDialogProps {
  readonly portfolioId: string;
}

function RecordCashFlowDialog({ portfolioId }: RecordCashFlowDialogProps) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<CashFlow["type"]>("DEPOSIT");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");

  const recordCashFlowMutationOpts =
    useRecordCashFlowMutationOptions(portfolioId);
  const { mutate, isPending } = useMutation({
    ...recordCashFlowMutationOpts,
    onSuccess: () => {
      setOpen(false);
      setAmount("");
      setDescription("");
      setType("DEPOSIT");
      toast.success("Cash flow recorded");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={<Button size="sm" type="button" className="gap-1.5" />}
      >
        <IconPlus className="h-4 w-4" />
        Record
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Record Cash Flow</DialogTitle>
        </DialogHeader>
        <form
          className="flex flex-col gap-4 pt-1"
          onSubmit={(e) => {
            e.preventDefault();
            mutate({
              type,
              amount: Number(amount),
              description: description || undefined,
            });
          }}
        >
          <div className="flex flex-col gap-1.5">
            <Label>Type</Label>
            <div className="grid grid-cols-2 gap-2">
              {(["DEPOSIT", "WITHDRAWAL", "DIVIDEND", "FEE"] as const).map(
                (t) => (
                  <Button
                    key={t}
                    type="button"
                    variant="ghost"
                    onClick={() => setType(t)}
                    className={cn(
                      "rounded-lg border py-2 text-xs font-medium transition-colors cursor-pointer",
                      type === t
                        ? CF_TYPE_CONFIG[t].cls
                        : "border-border text-muted-foreground hover:bg-muted",
                    )}
                  >
                    {CF_TYPE_CONFIG[t].label}
                  </Button>
                ),
              )}
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cf-amount">Amount</Label>
            <Input
              id="cf-amount"
              type="number"
              min="0"
              step="any"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="font-mono tabular-nums"
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cf-desc">Description (optional)</Label>
            <Input
              id="cf-desc"
              placeholder="e.g. Monthly deposit"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <Button type="submit" disabled={isPending || !amount}>
            {isPending ? "Recording…" : "Record Cash Flow"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Trades section ───────────────────────────────────────────────────────────

interface TradesSectionProps {
  readonly portfolioId: string;
  readonly instrumentsById: Map<
    string,
    { readonly ticker: string; readonly assetClass: string }
  >;
}

function TradesSection({ portfolioId, instrumentsById }: TradesSectionProps) {
  const { data: trades = [], isLoading } = useQuery(
    tradesQueryOptions(portfolioId),
  );

  const content = (() => {
    if (isLoading) return <Skeleton className="h-40 w-full rounded-xl" />;

    if (trades.length === 0) {
      return (
        <div className="flex items-center justify-center rounded-xl border border-dashed py-8">
          <p className="text-sm text-muted-foreground">
            No trades recorded yet
          </p>
        </div>
      );
    }

    return (
      <div className="overflow-hidden rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30 hover:bg-muted/30">
              <TableHead className="text-xs uppercase tracking-wider">
                Date
              </TableHead>
              <TableHead className="text-xs uppercase tracking-wider">
                Instrument
              </TableHead>
              <TableHead className="text-xs uppercase tracking-wider">
                Side
              </TableHead>
              <TableHead className="text-right text-xs uppercase tracking-wider">
                Qty
              </TableHead>
              <TableHead className="text-right text-xs uppercase tracking-wider">
                Price
              </TableHead>
              <TableHead className="text-right text-xs uppercase tracking-wider">
                Fees
              </TableHead>
              <TableHead className="text-right text-xs uppercase tracking-wider">
                Realized P&L
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {trades.map((trade) => (
              <TradeRow
                key={trade.id}
                trade={trade}
                instrumentsById={instrumentsById}
              />
            ))}
          </TableBody>
        </Table>
      </div>
    );
  })();

  return (
    <section>
      <div className="mb-4">
        <h2 className="border-l-2 border-primary pl-3 text-sm font-semibold uppercase tracking-widest text-muted-foreground">
          Trade History
        </h2>
      </div>
      {content}
    </section>
  );
}

interface TradeRowProps {
  readonly trade: Trade;
  readonly instrumentsById: Map<
    string,
    { readonly ticker: string; readonly assetClass: string }
  >;
}

function TradeRow({ trade, instrumentsById }: TradeRowProps) {
  const instrument = instrumentsById.get(trade.instrumentId);
  const isBuy = trade.side === "BUY";
  const pnl = trade.realizedPnl;
  const hasPnl = pnl != null;

  return (
    <TableRow className="hover:bg-muted/40">
      <TableCell className="text-sm text-muted-foreground">
        {new Date(trade.timestamp).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        })}
      </TableCell>
      <TableCell>
        {instrument ? (
          <span className="font-mono font-semibold">{instrument.ticker}</span>
        ) : (
          <span className="font-mono text-xs text-muted-foreground">
            {trade.instrumentId.slice(0, 8)}…
          </span>
        )}
      </TableCell>
      <TableCell>
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium",
            isBuy
              ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
              : "border-rose-500/20 bg-rose-500/10 text-rose-600 dark:text-rose-400",
          )}
        >
          {isBuy ? (
            <IconArrowUpRight className="h-3 w-3" />
          ) : (
            <IconArrowDownRight className="h-3 w-3" />
          )}
          {trade.side}
        </span>
      </TableCell>
      <TableCell className="text-right font-mono tabular-nums">
        {trade.quantity}
      </TableCell>
      <TableCell className="text-right font-mono tabular-nums">
        {trade.price.toLocaleString("en-US", { maximumFractionDigits: 6 })}
      </TableCell>
      <TableCell className="text-right font-mono tabular-nums text-muted-foreground">
        {trade.fees > 0
          ? trade.fees.toLocaleString("en-US", { maximumFractionDigits: 4 })
          : "—"}
      </TableCell>
      <TableCell className="text-right font-mono tabular-nums">
        {hasPnl && pnl != null ? (
          <span
            className={cn(
              "font-medium",
              pnl >= 0
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-rose-600 dark:text-rose-400",
            )}
          >
            {pnl >= 0 ? "+" : ""}
            {pnl.toLocaleString("en-US", { maximumFractionDigits: 2 })}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>
    </TableRow>
  );
}

// ─── Cash Flows section ───────────────────────────────────────────────────────

interface CashFlowsSectionProps {
  readonly portfolioId: string;
}

function CashFlowsSection({ portfolioId }: CashFlowsSectionProps) {
  const { data: cashFlows = [], isLoading } = useQuery(
    cashFlowsQueryOptions(portfolioId),
  );
  const deleteCashFlowMutationOpts =
    useDeleteCashFlowMutationOptions(portfolioId);
  const {
    mutate: deleteFlow,
    isPending: deleting,
    variables: deletingId,
  } = useMutation({
    ...deleteCashFlowMutationOpts,
    onSuccess: () => toast.success("Cash flow deleted"),
    onError: (err: Error) => toast.error(err.message),
  });

  const content = (() => {
    if (isLoading) return <Skeleton className="h-40 w-full rounded-xl" />;

    if (cashFlows.length === 0) {
      return (
        <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed py-8 text-center">
          <p className="text-sm text-muted-foreground">
            No cash flows recorded
          </p>
          <p className="max-w-sm text-xs text-muted-foreground">
            Record deposits, withdrawals, dividends and fees to enable accurate
            time-weighted return calculations.
          </p>
        </div>
      );
    }

    return (
      <div className="overflow-hidden rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30 hover:bg-muted/30">
              <TableHead className="text-xs uppercase tracking-wider">
                Date
              </TableHead>
              <TableHead className="text-xs uppercase tracking-wider">
                Type
              </TableHead>
              <TableHead className="text-right text-xs uppercase tracking-wider">
                Amount
              </TableHead>
              <TableHead className="text-xs uppercase tracking-wider">
                Description
              </TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {cashFlows.map((cf) => {
              const cfg = CF_TYPE_CONFIG[cf.type];
              return (
                <TableRow key={cf.id} className="group hover:bg-muted/40">
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(cf.timestamp).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </TableCell>
                  <TableCell>
                    <span
                      className={cn(
                        "rounded-md border px-2 py-0.5 text-xs font-medium",
                        cfg.cls,
                      )}
                    >
                      {cfg.label}
                    </span>
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums font-medium">
                    {cf.amount.toLocaleString("en-US", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {cf.description ?? "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => cf.id && deleteFlow(cf.id)}
                      disabled={deleting && deletingId === cf.id}
                      className="invisible rounded-md border p-1 text-muted-foreground transition-colors hover:border-rose-500/30 hover:bg-rose-500/10 hover:text-rose-600 group-hover:visible cursor-pointer disabled:opacity-50"
                    >
                      <IconTrash className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    );
  })();

  return (
    <section>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="border-l-2 border-primary pl-3 text-sm font-semibold uppercase tracking-widest text-muted-foreground">
          Cash Flows
        </h2>
        <RecordCashFlowDialog portfolioId={portfolioId} />
      </div>
      {content}
    </section>
  );
}

// ─── Analytics section ────────────────────────────────────────────────────────

interface AnalyticsSectionProps {
  readonly portfolioId: string;
}

function AnalyticsSection({ portfolioId }: AnalyticsSectionProps) {
  const { data: correlation, isLoading } = useQuery(
    correlationMatrixQueryOptions(portfolioId),
  );
  const { data: allocation } = useQuery(allocationQueryOptions(portfolioId));

  const hasPositions = (allocation?.byInstrument.length ?? 0) > 0;

  if (!hasPositions) return null;

  const content = (() => {
    if (isLoading) return <Skeleton className="h-32 w-full rounded" />;
    if (correlation) return <CorrelationHeatmap data={correlation} />;
    return null;
  })();

  return (
    <section>
      <div className="mb-4">
        <h2 className="border-l-2 border-primary pl-3 text-sm font-semibold uppercase tracking-widest text-muted-foreground">
          Analytics
        </h2>
      </div>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">
            Correlation Matrix
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Pairwise Pearson correlation of daily returns (trailing 365 days)
          </p>
        </CardHeader>
        <CardContent>{content}</CardContent>
      </Card>
    </section>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function PortfolioDetail({ portfolioId }: PortfolioDetailProps) {
  const { data: portfolio, isLoading: portfolioLoading } = useQuery(
    portfolioQueryOptions(portfolioId),
  );
  const { data: positions = [], isLoading: positionsLoading } = useQuery(
    positionsWithPnlQueryOptions(portfolioId),
  );
  const { data: metrics, isLoading: metricsLoading } = useQuery(
    performanceQueryOptions(portfolioId),
  );
  const { data: instrumentsData } = useQuery(
    instrumentsQueryOptions({ limit: 200 }),
  );

  const instrumentsById = new Map(
    (instrumentsData?.instruments ?? []).map((i) => [
      i.id ?? "",
      { ticker: i.ticker, assetClass: i.assetClass },
    ]),
  );

  if (portfolioLoading) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <Skeleton className="h-12 w-64" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {["sk-1", "sk-2", "sk-3", "sk-4"].map((key) => (
            <Skeleton key={key} className="h-28 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (!portfolio) {
    return (
      <div className="flex flex-col items-center gap-3 py-20 text-center">
        <IconFolderX className="h-8 w-8 text-muted-foreground" />
        <p className="font-medium">Portfolio not found</p>
      </div>
    );
  }

  const mode = MODE_CONFIG[portfolio.mode] ?? MODE_CONFIG.paper;

  const performanceContent = (() => {
    if (metricsLoading) {
      return (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {["sk-metrics-1", "sk-metrics-2", "sk-metrics-3", "sk-metrics-4"].map(
            (key) => (
              <Skeleton key={key} className="h-28 rounded-xl" />
            ),
          )}
        </div>
      );
    }

    if (metrics && metrics.snapshotCount > 0) {
      return (
        <PerformancePanel metrics={metrics} currency={portfolio.currency} />
      );
    }

    return (
      <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed py-10 text-center">
        <p className="font-medium">No snapshots recorded yet</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          Performance metrics (returns, Sharpe ratio, drawdown) are computed
          from NAV snapshots over time. Record your first snapshot to start
          tracking.
        </p>
        <RecordSnapshotDialog
          portfolioId={portfolioId}
          initialCapital={portfolio.initialCapital}
          currency={portfolio.currency}
        />
      </div>
    );
  })();

  const positionsContent = (() => {
    if (positionsLoading)
      return <Skeleton className="h-40 w-full rounded-xl" />;

    if (positions.length === 0) {
      return (
        <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed py-12 text-center">
          <p className="text-sm text-muted-foreground">
            No open positions yet.
          </p>
          <AddPositionDialog portfolioId={portfolioId} />
        </div>
      );
    }

    return (
      <div className="overflow-hidden rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30 hover:bg-muted/30">
              <TableHead className="text-xs uppercase tracking-wider">
                Instrument
              </TableHead>
              <TableHead className="text-xs uppercase tracking-wider">
                Side
              </TableHead>
              <TableHead className="text-right text-xs uppercase tracking-wider">
                Qty
              </TableHead>
              <TableHead className="text-right text-xs uppercase tracking-wider">
                Avg Cost
              </TableHead>
              <TableHead className="text-right text-xs uppercase tracking-wider">
                Price
              </TableHead>
              <TableHead className="text-right text-xs uppercase tracking-wider">
                Mkt Value
              </TableHead>
              <TableHead className="text-right text-xs uppercase tracking-wider">
                Unr. P&L
              </TableHead>
              <TableHead className="text-right text-xs uppercase tracking-wider">
                Wt
              </TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {positions.map((pos) => (
              <PositionRow
                key={pos.id}
                position={pos}
                portfolioId={portfolioId}
              />
            ))}
          </TableBody>
        </Table>
      </div>
    );
  })();

  return (
    <div className="flex flex-col gap-8 p-6 max-w-7xl">
      {/* Hero */}
      <section className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <IconCircleFilled
              className={cn(
                "h-2.5 w-2.5 shrink-0",
                portfolio.status === "active"
                  ? "text-emerald-500"
                  : "text-muted-foreground/30",
              )}
            />
            <h1 className="text-2xl font-bold">{portfolio.name}</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            {portfolio.currency} · Initial capital:{" "}
            <span className="font-mono tabular-nums font-medium text-foreground">
              {portfolio.initialCapital.toLocaleString("en-US", {
                maximumFractionDigits: 0,
              })}
            </span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-sm font-medium",
              mode.bg,
              mode.text,
              mode.border,
            )}
          >
            <span className={cn("h-1.5 w-1.5 rounded-full", mode.dot)} />
            {mode.label}
          </span>
          <span className="rounded-md border px-2.5 py-1 text-sm capitalize text-muted-foreground">
            {portfolio.status}
          </span>
        </div>
      </section>

      {/* Performance */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="border-l-2 border-primary pl-3 text-sm font-semibold uppercase tracking-widest text-muted-foreground">
            Performance
          </h2>
          <div className="flex items-center gap-2">
            <AutoSnapshotButton
              portfolioId={portfolioId}
              currency={portfolio.currency}
            />
            <RecordSnapshotDialog
              portfolioId={portfolioId}
              initialCapital={portfolio.initialCapital}
              currency={portfolio.currency}
            />
          </div>
        </div>
        {performanceContent}
      </section>

      {/* NAV History */}
      <section>
        <h2 className="mb-4 border-l-2 border-primary pl-3 text-sm font-semibold uppercase tracking-widest text-muted-foreground">
          NAV History
        </h2>
        <NavChart portfolioId={portfolioId} />
      </section>

      {/* Open Positions */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="border-l-2 border-primary pl-3 text-sm font-semibold uppercase tracking-widest text-muted-foreground">
              Open Positions
            </h2>
            {!positionsLoading && (
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                {positions.length}
              </span>
            )}
          </div>
          <AddPositionDialog portfolioId={portfolioId} />
        </div>

        {positionsContent}
      </section>

      {/* Trade History */}
      <TradesSection
        portfolioId={portfolioId}
        instrumentsById={instrumentsById}
      />

      {/* Cash Flows */}
      <CashFlowsSection portfolioId={portfolioId} />

      {/* Analytics */}
      <AnalyticsSection portfolioId={portfolioId} />
    </div>
  );
}
