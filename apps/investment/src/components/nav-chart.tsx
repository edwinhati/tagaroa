"use client";

import { snapshotHistoryQueryOptions } from "@repo/common/lib/query/portfolio-query";
import type { SnapshotHistoryItem } from "@repo/common/types/investment";
import { Button } from "@repo/ui/components/button";
import { useQuery } from "@tanstack/react-query";
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

const DATE_RANGES = [
  { label: "30D", days: 30 },
  { label: "90D", days: 90 },
  { label: "1Y", days: 365 },
  { label: "All", days: null },
] as const;

function formatDate(timestamp: string): string {
  return new Date(timestamp).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

interface NavChartProps {
  portfolioId: string;
}

export function NavChart({ portfolioId }: NavChartProps) {
  const [selectedRange, setSelectedRange] = useState<number | null>(90);

  const startDate =
    selectedRange !== null
      ? new Date(Date.now() - selectedRange * 24 * 60 * 60 * 1000).toISOString()
      : undefined;

  const { data: history, isLoading } = useQuery(
    snapshotHistoryQueryOptions(
      portfolioId,
      startDate,
      new Date().toISOString(),
    ),
  );

  if (isLoading) {
    return <div className="h-64 animate-pulse rounded-lg bg-muted" />;
  }

  if (!history || history.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
        No snapshot data yet. Record a snapshot to see NAV history.
      </div>
    );
  }

  const isUp =
    history.length > 1
      ? (history[history.length - 1]?.nav ?? 0) >= (history[0]?.nav ?? 0)
      : true;

  const gradientId = `navGradient-${portfolioId}`;
  const strokeColor = isUp
    ? "var(--color-emerald-500)"
    : "var(--color-rose-500)";
  const fillId = `url(#${gradientId})`;

  return (
    <div className="space-y-3">
      <div className="flex gap-1">
        {DATE_RANGES.map((range) => (
          <Button
            key={range.label}
            type="button"
            onClick={() => setSelectedRange(range.days)}
            variant="outline"
            size="sm"
          >
            {range.label}
          </Button>
        ))}
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <AreaChart
          data={history}
          margin={{ top: 4, right: 4, bottom: 0, left: 0 }}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop
                offset="5%"
                stopColor={isUp ? "#10b981" : "#f43f5e"}
                stopOpacity={0.3}
              />
              <stop
                offset="95%"
                stopColor={isUp ? "#10b981" : "#f43f5e"}
                stopOpacity={0}
              />
            </linearGradient>
          </defs>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="var(--border)"
            strokeOpacity={0.5}
          />
          <XAxis
            dataKey="timestamp"
            tickFormatter={formatDate}
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            tickFormatter={(v) => formatCurrency(v)}
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            tickLine={false}
            axisLine={false}
            width={70}
          />
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.[0]) return null;
              const item = payload[0].payload as SnapshotHistoryItem;
              return (
                <div className="rounded-lg border bg-popover p-2 shadow-md text-xs">
                  <p className="font-medium">
                    {new Date(item.timestamp).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </p>
                  <p className="text-muted-foreground">
                    NAV:{" "}
                    <span className="font-mono font-medium text-foreground">
                      {formatCurrency(item.nav)}
                    </span>
                  </p>
                  <p className="text-muted-foreground">
                    Cash:{" "}
                    <span className="font-mono">
                      {formatCurrency(item.cash)}
                    </span>
                  </p>
                  {item.drawdown > 0 && (
                    <p className="text-rose-500">
                      Drawdown: {item.drawdown.toFixed(2)}%
                    </p>
                  )}
                </div>
              );
            }}
          />
          <Area
            type="monotone"
            dataKey="nav"
            stroke={strokeColor}
            strokeWidth={2}
            fill={fillId}
            dot={false}
            activeDot={{ r: 4, fill: strokeColor }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
