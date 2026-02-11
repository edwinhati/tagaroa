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
import React from "react";
import { useQuery } from "@tanstack/react-query";
import { TrendingUp } from "lucide-react";
import type { DateRange } from "react-day-picker";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";

export const description = "An area chart showing transaction trends over time";

const chartConfig = {
  income: {
    label: "Income",
    color: "hsl(142, 76%, 36%)", // Emerald green
  },
  expenses: {
    label: "Expenses",
    color: "hsl(349, 89%, 60%)", // Rose red
  },
} satisfies ChartConfig;

const TransactionTrendsChart = React.memo(
  ({ range }: { range?: DateRange }) => {
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
        <Card className="flex flex-col h-full">
          <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
            <div>
              <CardTitle className="text-base font-semibold">
                Transaction Trends
              </CardTitle>
              <CardDescription className="text-xs">
                Income vs Expenses over time
              </CardDescription>
            </div>
            <div className="p-2.5 rounded-xl bg-cyan-500/10 ring-1 ring-cyan-500/20">
              <TrendingUp className="h-4 w-4 text-cyan-500" />
            </div>
          </CardHeader>
          <CardContent className="flex-1 flex items-center justify-center pb-4">
            <Skeleton className="h-[200px] w-full rounded-lg" />
          </CardContent>
        </Card>
      );
    }

    const chartData =
      (data?.trends ?? []).map((item) => ({
        period: item.period,
        income: item.income,
        expenses: item.expenses,
      })) ?? [];

    return (
      <Card className="flex flex-col h-full cursor-pointer group transition-all duration-300 hover:shadow-xl hover:shadow-primary/10 hover:-translate-y-1 border-border/50 hover:border-primary/30 bg-card/80 backdrop-blur-sm">
        <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
          <div>
            <CardTitle className="text-base font-semibold group-hover:text-primary transition-colors duration-200">
              Transaction Trends
            </CardTitle>
            <CardDescription className="text-xs">
              Income vs Expenses over time
            </CardDescription>
          </div>
          <div className="p-2.5 rounded-xl bg-cyan-500/10 ring-1 ring-cyan-500/20 group-hover:bg-cyan-500/20 group-hover:scale-110 transition-all duration-200">
            <TrendingUp className="h-4 w-4 text-cyan-500" />
          </div>
        </CardHeader>
        <CardContent className="flex-1 pb-4">
          <ChartContainer
            config={chartConfig}
            className="mx-auto h-[200px] w-full"
          >
            <AreaChart data={chartData} accessibilityLayer>
              <defs>
                <linearGradient id="fillIncome" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="5%"
                    stopColor="var(--color-income)"
                    stopOpacity={0.6}
                  />
                  <stop
                    offset="95%"
                    stopColor="var(--color-income)"
                    stopOpacity={0.05}
                  />
                </linearGradient>
                <linearGradient id="fillExpenses" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="5%"
                    stopColor="var(--color-expenses)"
                    stopOpacity={0.6}
                  />
                  <stop
                    offset="95%"
                    stopColor="var(--color-expenses)"
                    stopOpacity={0.05}
                  />
                </linearGradient>
              </defs>
              <CartesianGrid
                vertical={false}
                strokeDasharray="3 3"
                className="stroke-muted/30"
              />
              <XAxis
                dataKey="period"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                minTickGap={32}
                className="text-[10px]"
                tickFormatter={(value) => {
                  const date = new Date(value);
                  return date.toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  });
                }}
              />
              <YAxis hide />
              <ChartTooltip
                cursor={{
                  stroke: "hsl(var(--muted-foreground))",
                  strokeWidth: 1,
                  strokeDasharray: "3 3",
                }}
                content={
                  <ChartTooltipContent
                    labelFormatter={(value) => {
                      return new Date(value).toLocaleDateString("en-US", {
                        month: "long",
                        year: "numeric",
                      });
                    }}
                    indicator="dot"
                  />
                }
              />
              <Area
                dataKey="expenses"
                type="monotone"
                fill="url(#fillExpenses)"
                stroke="var(--color-expenses)"
                strokeWidth={2}
              />
              <Area
                dataKey="income"
                type="monotone"
                fill="url(#fillIncome)"
                stroke="var(--color-income)"
                strokeWidth={2}
              />
            </AreaChart>
          </ChartContainer>
        </CardContent>
      </Card>
    );
  },
);

TransactionTrendsChart.displayName = "TransactionTrendsChart";

export { TransactionTrendsChart };

export const TransactionTrendsChartSkeleton = () => {
  return (
    <Card className="flex flex-col h-full">
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
        <div>
          <CardTitle className="text-base font-semibold">
            Transaction Trends
          </CardTitle>
          <CardDescription className="text-xs">
            Income vs Expenses over time
          </CardDescription>
        </div>
        <div className="p-2.5 rounded-xl bg-cyan-500/10 ring-1 ring-cyan-500/20">
          <TrendingUp className="h-4 w-4 text-cyan-500" />
        </div>
      </CardHeader>
      <CardContent className="flex-1 flex items-center justify-center pb-4">
        <Skeleton className="h-[200px] w-full rounded-lg" />
      </CardContent>
    </Card>
  );
};
