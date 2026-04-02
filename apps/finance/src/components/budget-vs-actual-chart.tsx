"use client";

import { budgetPerformanceQueryOptions } from "@repo/common/lib/query/finance-dashboard-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
} from "@repo/ui/components/chart";
import { Skeleton } from "@repo/ui/components/skeleton";
import { IconTarget } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import React from "react";
import type { DateRange } from "react-day-picker";
import { Bar, BarChart, CartesianGrid, Cell, XAxis, YAxis } from "recharts";
import { formatCurrencyCompact } from "@/utils/currency";

const chartConfig = {
  allocated: {
    label: "Allocated",
    color: "hsl(217, 91%, 60%)", // Vibrant blue
  },
  spent: {
    label: "Spent",
    color: "hsl(38, 92%, 50%)", // Amber/gold
  },
} satisfies ChartConfig;

interface BudgetTooltipProps {
  active?: boolean;
  payload?: Array<{
    dataKey: string;
    value: number;
    payload: {
      category: string;
      allocated: number;
      spent: number;
      remaining: number;
      percentage: number;
      is_over_budget: boolean;
    };
  }>;
  label?: string;
}

function BudgetTooltip({ active, payload, label }: BudgetTooltipProps) {
  if (!active || !payload?.length) return null;

  const first = payload[0];
  if (!first) return null;
  const data = first.payload;
  const categoryName = label ?? data.category;
  const spentColor = data.is_over_budget
    ? "hsl(349, 89%, 60%)"
    : "hsl(38, 92%, 50%)";

  return (
    <div className="rounded-xl border border-border/50 bg-background/95 backdrop-blur-sm shadow-xl p-3 text-xs min-w-[160px]">
      <p className="text-[11px] font-medium text-muted-foreground border-b border-border/40 pb-2 mb-2.5">
        {categoryName}
      </p>
      <div className="flex items-center justify-between gap-4 mb-1.5">
        <div className="flex items-center gap-1.5">
          <span
            className="size-2 rounded-full shrink-0"
            style={{ backgroundColor: "hsl(217, 91%, 60%)" }}
          />
          <span className="text-muted-foreground">Allocated</span>
        </div>
        <span className="font-semibold text-foreground tabular-nums">
          {formatCurrencyCompact(data.allocated, "IDR")}
        </span>
      </div>
      <div className="flex items-center justify-between gap-4 mb-1.5">
        <div className="flex items-center gap-1.5">
          <span
            className="size-2 rounded-full shrink-0"
            style={{ backgroundColor: spentColor }}
          />
          <span className="text-muted-foreground">Spent</span>
        </div>
        <span className="font-semibold text-foreground tabular-nums">
          {formatCurrencyCompact(data.spent, "IDR")}
        </span>
      </div>
      <div className="flex items-center justify-between gap-4 mb-2">
        <span className="text-muted-foreground">Usage</span>
        <span className="font-semibold text-foreground tabular-nums">
          {data.percentage.toFixed(1)}% used
        </span>
      </div>
      <div>
        {data.is_over_budget ? (
          <span className="inline-flex items-center bg-rose-500/10 text-rose-500 px-1.5 py-0.5 rounded-md font-medium tabular-nums">
            Over: {formatCurrencyCompact(Math.abs(data.remaining), "IDR")}
          </span>
        ) : (
          <span className="inline-flex items-center bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-1.5 py-0.5 rounded-md font-medium tabular-nums">
            Left: {formatCurrencyCompact(Math.abs(data.remaining), "IDR")}
          </span>
        )}
      </div>
    </div>
  );
}

const BudgetVsActualChart = React.memo(({ range }: { range?: DateRange }) => {
  // Use range.to for budget period since budget periods run from 25th of prev month to 25th of current month
  // The budget period is named after the ending month (e.g., Dec 25 - Jan 25 is January's budget)
  const month = range?.to ? range.to.getMonth() + 1 : new Date().getMonth() + 1;
  const year = range?.to ? range.to.getFullYear() : new Date().getFullYear();

  const { data, isLoading } = useQuery({
    ...budgetPerformanceQueryOptions({ month, year }),
  });

  const monthName = new Date(year, month - 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  if (isLoading) {
    return (
      <Card className="h-full">
        <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-4">
          <div>
            <CardTitle className="text-base font-semibold">
              Budget vs Actual
            </CardTitle>
            <CardDescription className="text-xs">{monthName}</CardDescription>
          </div>
          <div className="p-2.5 rounded-xl bg-amber-500/10 ring-1 ring-amber-500/20">
            <IconTarget className="h-4 w-4 text-amber-500" />
          </div>
        </CardHeader>
        <CardContent className="pl-2">
          <Skeleton className="h-[280px] w-full rounded-lg" />
        </CardContent>
      </Card>
    );
  }

  const chartData =
    (data?.items ?? []).map((item) => ({
      category: item.category,
      allocated: item.allocated,
      spent: item.spent,
      remaining: item.remaining,
      percentage: item.percentage,
      is_over_budget: item.is_over_budget,
    })) ?? [];

  return (
    <Card className="h-full border-border/40 bg-card/60 backdrop-blur-md shadow-sm ">
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-4">
        <div>
          <CardTitle className="text-base font-semibold">
            Budget vs Actual
          </CardTitle>
          <CardDescription className="text-xs">{monthName}</CardDescription>
        </div>
        <div className="p-2.5 rounded-xl bg-amber-500/10 ring-1 ring-amber-500/20">
          <IconTarget className="h-4 w-4 text-amber-500" />
        </div>
      </CardHeader>
      <CardContent className="pl-2">
        <ChartContainer config={chartConfig} className="h-[280px] w-full">
          <BarChart data={chartData} accessibilityLayer barGap={4}>
            <CartesianGrid
              vertical={false}
              strokeDasharray="3 3"
              className="stroke-muted/30"
            />
            <XAxis
              dataKey="category"
              tickLine={false}
              tickMargin={10}
              axisLine={false}
              className="text-[10px]"
              tickFormatter={(value) =>
                value.length > 8 ? `${value.slice(0, 8)}...` : value
              }
            />
            <YAxis hide />
            <ChartTooltip
              cursor={{ fill: "hsl(var(--muted)/0.3)" }}
              content={<BudgetTooltip />}
            />
            <Bar
              dataKey="allocated"
              fill="var(--color-allocated)"
              radius={[4, 4, 0, 0]}
              className="transition-opacity duration-200 hover:opacity-80"
            />
            <Bar dataKey="spent" radius={[4, 4, 0, 0]}>
              {chartData.map((entry) => (
                <Cell
                  key={entry.category}
                  fill={
                    entry.is_over_budget
                      ? "hsl(349, 89%, 60%)"
                      : "var(--color-spent)"
                  }
                  className="transition-opacity duration-200 hover:opacity-80"
                />
              ))}
            </Bar>
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
});

BudgetVsActualChart.displayName = "BudgetVsActualChart";

export { BudgetVsActualChart };
