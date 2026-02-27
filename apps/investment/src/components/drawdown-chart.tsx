"use client";

import { snapshotHistoryQueryOptions } from "@repo/common/lib/query/portfolio-query";
import type { SnapshotHistoryItem } from "@repo/common/types/investment";
import { useQuery } from "@tanstack/react-query";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

function formatDate(timestamp: string): string {
  return new Date(timestamp).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

interface DrawdownChartProps {
  portfolioId: string;
  startDate?: string;
  endDate?: string;
}

export function DrawdownChart({
  portfolioId,
  startDate,
  endDate,
}: DrawdownChartProps) {
  const { data: history, isLoading } = useQuery(
    snapshotHistoryQueryOptions(portfolioId, startDate, endDate),
  );

  if (isLoading) {
    return <div className="h-32 animate-pulse rounded-lg bg-muted" />;
  }

  if (!history || history.every((h) => h.drawdown === 0)) {
    return null;
  }

  // Invert drawdown to show as negative (below 0 line)
  const data = history.map((h) => ({
    ...h,
    drawdownNeg: -h.drawdown,
  }));

  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-muted-foreground">Drawdown %</p>
      <ResponsiveContainer width="100%" height={100}>
        <AreaChart
          data={data}
          margin={{ top: 4, right: 4, bottom: 0, left: 0 }}
        >
          <defs>
            <linearGradient
              id={`ddGradient-${portfolioId}`}
              x1="0"
              y1="0"
              x2="0"
              y2="1"
            >
              <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.4} />
              <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
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
            tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            tickFormatter={(v) => `${Math.abs(v).toFixed(1)}%`}
            tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
            tickLine={false}
            axisLine={false}
            width={40}
            domain={["dataMin", 0]}
          />
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.[0]) return null;
              const item = payload[0].payload as SnapshotHistoryItem & {
                drawdownNeg: number;
              };
              return (
                <div className="rounded-lg border bg-popover p-2 shadow-md text-xs">
                  <p className="font-medium">{formatDate(item.timestamp)}</p>
                  <p className="text-rose-500">
                    Drawdown: {item.drawdown.toFixed(2)}%
                  </p>
                </div>
              );
            }}
          />
          <Area
            type="monotone"
            dataKey="drawdownNeg"
            stroke="#f43f5e"
            strokeWidth={1.5}
            fill={`url(#ddGradient-${portfolioId})`}
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
