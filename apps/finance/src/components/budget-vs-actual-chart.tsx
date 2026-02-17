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
  ChartTooltipContent,
} from "@repo/ui/components/chart";
import { Skeleton } from "@repo/ui/components/skeleton";
import { useQuery } from "@tanstack/react-query";
import { Target } from "lucide-react";
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
            <Target className="h-4 w-4 text-amber-500" />
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
    <Card className="h-full border-border/50 bg-card/80 backdrop-blur-sm shadow-sm hover:shadow-md transition-shadow duration-200">
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-4">
        <div>
          <CardTitle className="text-base font-semibold">
            Budget vs Actual
          </CardTitle>
          <CardDescription className="text-xs">{monthName}</CardDescription>
        </div>
        <div className="p-2.5 rounded-xl bg-amber-500/10 ring-1 ring-amber-500/20">
          <Target className="h-4 w-4 text-amber-500" />
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
              content={
                <ChartTooltipContent
                  indicator="dashed"
                  formatter={(value, name, item) => {
                    const payload = item.payload;
                    if (name === "allocated") {
                      return formatCurrencyCompact(value as number, "IDR");
                    }
                    if (name === "spent") {
                      return (
                        <div className="flex flex-col gap-0.5">
                          <span className="font-medium">
                            {formatCurrencyCompact(value as number, "IDR")}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {payload.percentage.toFixed(1)}% of budget
                          </span>
                          <span
                            className={`text-xs ${
                              payload.is_over_budget
                                ? "text-rose-500"
                                : "text-emerald-500"
                            }`}
                          >
                            {payload.is_over_budget ? "Over" : "Remaining"}:{" "}
                            {formatCurrencyCompact(
                              Math.abs(payload.remaining),
                              "IDR",
                            )}
                          </span>
                        </div>
                      );
                    }
                    return value;
                  }}
                />
              }
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

export const BudgetVsActualChartSkeleton = () => {
  return (
    <Card className="h-full">
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-4">
        <div>
          <CardTitle className="text-base font-semibold">
            Budget vs Actual
          </CardTitle>
          <CardDescription className="text-xs">
            Budget performance overview
          </CardDescription>
        </div>
        <div className="p-2.5 rounded-xl bg-amber-500/10 ring-1 ring-amber-500/20">
          <Target className="h-4 w-4 text-amber-500" />
        </div>
      </CardHeader>
      <CardContent className="pl-2">
        <Skeleton className="h-[280px] w-full rounded-lg" />
      </CardContent>
    </Card>
  );
};
