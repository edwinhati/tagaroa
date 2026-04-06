"use client";

import { transactionTrendsQueryOptions } from "@repo/common/lib/query/finance-dashboard-query";
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
import { IconTrendingUp } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import React from "react";
import type { DateRange } from "react-day-picker";
import { Area, AreaChart, CartesianGrid, Line, XAxis, YAxis } from "recharts";
import { formatCurrencyCompact } from "@/utils/currency";

const chartConfig = {
  income: {
    label: "Income",
    color: "hsl(142, 76%, 36%)", // Emerald green
  },
  expenses: {
    label: "Expenses",
    color: "hsl(349, 89%, 60%)", // Rose red
  },
  net_flow: {
    label: "Net Flow",
    color: "hsl(38, 92%, 50%)", // Amber/gold
  },
} satisfies ChartConfig;

interface TrendsTooltipProps {
  active?: boolean;
  payload?: Array<{
    dataKey: string;
    value: number;
    color: string;
    name: string;
  }>;
  label?: string;
}

function TrendsTooltip({ active, payload, label }: TrendsTooltipProps) {
  if (!active || !payload?.length) return null;

  const income = payload.find((p) => p.dataKey === "income");
  const expenses = payload.find((p) => p.dataKey === "expenses");
  const netFlow = payload.find((p) => p.dataKey === "net_flow");

  const formattedDate = label
    ? new Date(label).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : "";

  const netValue = netFlow?.value ?? 0;
  const netFormatted =
    netValue >= 0
      ? `+${formatCurrencyCompact(netValue, "IDR")}`
      : `-${formatCurrencyCompact(Math.abs(netValue), "IDR")}`;

  return (
    <div className="rounded-xl border border-border/50 bg-background/95 backdrop-blur-sm shadow-xl p-3 text-xs min-w-[160px]">
      <p className="text-[11px] font-medium text-muted-foreground border-b border-border/40 pb-2 mb-2.5">
        {formattedDate}
      </p>
      {income && (
        <div className="flex items-center justify-between gap-4 mb-1.5">
          <div className="flex items-center gap-1.5">
            <span
              className="size-2 rounded-full shrink-0"
              style={{ backgroundColor: "hsl(142, 76%, 36%)" }}
            />
            <span className="text-muted-foreground">Income</span>
          </div>
          <span className="font-semibold text-foreground tabular-nums">
            {formatCurrencyCompact(income.value, "IDR")}
          </span>
        </div>
      )}
      {expenses && (
        <div className="flex items-center justify-between gap-4 mb-1.5">
          <div className="flex items-center gap-1.5">
            <span
              className="size-2 rounded-full shrink-0"
              style={{ backgroundColor: "hsl(349, 89%, 60%)" }}
            />
            <span className="text-muted-foreground">Expenses</span>
          </div>
          <span className="font-semibold text-foreground tabular-nums">
            {formatCurrencyCompact(expenses.value, "IDR")}
          </span>
        </div>
      )}
      {netFlow && (
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-1.5">
            <span
              className="size-2 rounded-full shrink-0"
              style={{ backgroundColor: "hsl(38, 92%, 50%)" }}
            />
            <span className="text-muted-foreground">Net Flow</span>
          </div>
          <span className="font-semibold text-foreground tabular-nums">
            {netFormatted}
          </span>
        </div>
      )}
    </div>
  );
}

const TransactionTrendsChart = React.memo(
  ({ range }: { range?: DateRange }) => {
    const queryParams = {
      startDate: range?.from
        ? range.from.toISOString().split("T")[0]
        : undefined,
      endDate: range?.to ? range.to.toISOString().split("T")[0] : undefined,
    };

    const { data, isLoading } = useQuery({
      ...transactionTrendsQueryOptions(queryParams),
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
              <IconTrendingUp className="h-4 w-4 text-cyan-500" />
            </div>
          </CardHeader>
          <CardContent className="flex-1 flex items-center justify-center pb-4">
            <Skeleton className="h-[280px] w-full rounded-lg" />
          </CardContent>
        </Card>
      );
    }

    const chartData =
      (data?.trends ?? []).map((item) => ({
        period: item.period,
        income: item.income,
        expenses: item.expenses,
        net_flow: item.net_flow,
      })) ?? [];

    // Check if we have any non-zero data
    const hasData = chartData.some(
      (item) => item.income > 0 || item.expenses > 0,
    );

    if (!hasData && chartData.length > 0) {
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
              <IconTrendingUp className="h-4 w-4 text-cyan-500" />
            </div>
          </CardHeader>
          <CardContent className="flex-1 flex items-center justify-center pb-4">
            <p className="text-sm text-muted-foreground">
              No transaction data for this period
            </p>
          </CardContent>
        </Card>
      );
    }

    return (
      <Card className="flex flex-col h-full border-border/40 bg-card/60 backdrop-blur-md shadow-sm ">
        <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-4">
          <div>
            <CardTitle className="text-base font-semibold">
              Transaction Trends
            </CardTitle>
            <CardDescription className="text-xs">
              Income vs Expenses over time
            </CardDescription>
          </div>
          <div className="p-2.5 rounded-xl bg-cyan-500/10 ring-1 ring-cyan-500/20">
            <IconTrendingUp className="h-4 w-4 text-cyan-500" />
          </div>
        </CardHeader>
        <CardContent className="flex-1 pb-4">
          <ChartContainer
            config={chartConfig}
            className="mx-auto h-[280px] w-full"
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
                content={<TrendsTooltip />}
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
              <Line
                dataKey="net_flow"
                type="monotone"
                stroke="var(--color-net_flow)"
                strokeWidth={2}
                dot={false}
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
