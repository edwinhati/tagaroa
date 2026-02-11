"use client";

import { transactionTrendsQueryOptions } from "@repo/common/lib/query/finance-dashboard";
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
import { BarChart3 } from "lucide-react";
import React from "react";
import type { DateRange } from "react-day-picker";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

const chartConfig = {
  income: {
    label: "Income",
    color: "hsl(142, 76%, 36%)", // Emerald green
  },
  expenses: {
    label: "Expenses",
    color: "hsl(349, 89%, 60%)", // Rose red
  },
  net: {
    label: "Net",
    color: "hsl(38, 92%, 50%)", // Amber/gold
  },
} satisfies ChartConfig;

const MonthlyComparisonChart = React.memo(({ range }: { range?: DateRange }) => {
  const { data, isLoading } = useQuery({
    ...transactionTrendsQueryOptions({
      startDate: range?.from
        ? range.from.toISOString().split("T")[0]
        : undefined,
      endDate: range?.to ? range.to.toISOString().split("T")[0] : undefined,
      granularity: "month",
    }),
  });

  if (isLoading) {
    return (
      <Card className="w-full h-full">
        <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
          <div>
            <CardTitle className="text-base font-semibold">
              Monthly Comparison
            </CardTitle>
            <CardDescription className="text-xs">
              Income, Expenses, and Net by month
            </CardDescription>
          </div>
          <div className="p-2.5 rounded-xl bg-indigo-500/10 ring-1 ring-indigo-500/20">
            <BarChart3 className="h-4 w-4 text-indigo-500" />
          </div>
        </CardHeader>
        <CardContent className="pl-2">
          <Skeleton className="h-[280px] w-full rounded-lg" />
        </CardContent>
      </Card>
    );
  }

  const chartData =
    data?.trends.map((item) => ({
      month: item.period,
      income: item.income,
      expenses: item.expenses,
      net: item.net_flow,
    })) ?? [];

  return (
    <Card className="w-full h-full cursor-pointer group transition-all duration-300 hover:shadow-xl hover:shadow-primary/10 hover:-translate-y-1 border-border/50 hover:border-primary/30 bg-card/80 backdrop-blur-sm">
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
        <div>
          <CardTitle className="text-base font-semibold group-hover:text-primary transition-colors duration-200">
            Monthly Comparison
          </CardTitle>
          <CardDescription className="text-xs">
            Income, Expenses, and Net by month
          </CardDescription>
        </div>
        <div className="p-2.5 rounded-xl bg-indigo-500/10 ring-1 ring-indigo-500/20 group-hover:bg-indigo-500/20 group-hover:scale-110 transition-all duration-200">
          <BarChart3 className="h-4 w-4 text-indigo-500" />
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
              dataKey="month"
              tickLine={false}
              tickMargin={10}
              axisLine={false}
              className="text-[10px]"
              tickFormatter={(value) => {
                const date = new Date(value);
                return date.toLocaleDateString("en-US", { month: "short" });
              }}
            />
            <YAxis hide />
            <ChartTooltip
              cursor={{ fill: "hsl(var(--muted)/0.3)" }}
              content={
                <ChartTooltipContent
                  labelFormatter={(value) => {
                    return new Date(value).toLocaleDateString("en-US", {
                      month: "long",
                      year: "numeric",
                    });
                  }}
                  indicator="dashed"
                />
              }
            />
            <Bar
              dataKey="income"
              fill="var(--color-income)"
              radius={[4, 4, 0, 0]}
              className="transition-opacity duration-200 hover:opacity-80"
            />
            <Bar
              dataKey="expenses"
              fill="var(--color-expenses)"
              radius={[4, 4, 0, 0]}
              className="transition-opacity duration-200 hover:opacity-80"
            />
            <Bar
              dataKey="net"
              fill="var(--color-net)"
              radius={[4, 4, 0, 0]}
              className="transition-opacity duration-200 hover:opacity-80"
            />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
});

MonthlyComparisonChart.displayName = "MonthlyComparisonChart";

export { MonthlyComparisonChart };
