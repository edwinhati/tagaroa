"use client";

import { expenseBreakdownQueryOptions } from "@repo/common/lib/query/finance-dashboard-query";
import { Button } from "@repo/ui/components/button";
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
import { cn } from "@repo/ui/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { PieChart as PieChartIcon } from "lucide-react";
import React, { useMemo, useState } from "react";
import type { DateRange } from "react-day-picker";
import { Cell, Label, Pie, PieChart } from "recharts";
import { formatCurrencyCompact, formatCurrencySmart } from "@/utils/currency";

export const description =
  "A donut chart showing expense breakdown by category";

// Premium color palette for expense categories
const CHART_COLORS = [
  "hsl(349, 89%, 60%)", // Rose red
  "hsl(38, 92%, 50%)", // Amber/gold
  "hsl(142, 76%, 36%)", // Emerald green
  "hsl(217, 91%, 60%)", // Vibrant blue
  "hsl(280, 87%, 65%)", // Purple
];

const ExpenseBreakdownChart = React.memo(({ range }: { range?: DateRange }) => {
  const [showAll, setShowAll] = useState(false);

  const { data, isLoading } = useQuery({
    ...expenseBreakdownQueryOptions({
      startDate: range?.from
        ? range.from.toISOString().split("T")[0]
        : undefined,
      endDate: range?.to ? range.to.toISOString().split("T")[0] : undefined,
    }),
  });

  const allChartData = useMemo(() => {
    return (
      data?.items.map((item, index) => ({
        name: item.category,
        value: item.amount,
        percentage: item.percentage,
        fill: CHART_COLORS[index % CHART_COLORS.length],
      })) ?? []
    );
  }, [data]);

  const chartData = useMemo(() => {
    if (showAll || allChartData.length <= 5) {
      return allChartData;
    }
    // Show top 5 and combine the rest into "Others"
    const top5 = allChartData.slice(0, 5);
    const others = allChartData.slice(5);
    if (others.length > 0) {
      const othersTotal = others.reduce((sum, item) => sum + item.value, 0);
      const othersPercentage = others.reduce(
        (sum, item) => sum + item.percentage,
        0,
      );
      top5.push({
        name: "Others",
        value: othersTotal,
        percentage: othersPercentage,
        fill: "hsl(var(--muted-foreground))",
      });
    }
    return top5;
  }, [allChartData, showAll]);

  const chartConfig = useMemo(() => {
    const config: ChartConfig = {
      value: { label: "Amount" },
    };
    chartData.forEach((item, index) => {
      config[item.name.toLowerCase().replace(/\s/g, "")] = {
        label: item.name,
        color: CHART_COLORS[index % CHART_COLORS.length],
      };
    });
    return config;
  }, [chartData]);

  const totalExpenses = useMemo(() => {
    return chartData.reduce((sum, item) => sum + item.value, 0);
  }, [chartData]);

  if (isLoading) {
    return (
      <Card className="flex flex-col h-full">
        <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-4">
          <div>
            <CardTitle className="text-base font-semibold">
              Expense Breakdown
            </CardTitle>
            <CardDescription className="text-xs">
              Spending by category
            </CardDescription>
          </div>
          <div className="p-2.5 rounded-xl bg-rose-500/10 ring-1 ring-rose-500/20">
            <PieChartIcon className="h-4 w-4 text-rose-500" />
          </div>
        </CardHeader>
        <CardContent className="flex-1 flex items-center justify-center pb-4">
          <Skeleton className="aspect-square h-[180px] rounded-full" />
        </CardContent>
      </Card>
    );
  }

  // Handle empty data state
  if (!chartData.length) {
    return (
      <Card className="flex flex-col h-full">
        <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-4">
          <div>
            <CardTitle className="text-base font-semibold">
              Expense Breakdown
            </CardTitle>
            <CardDescription className="text-xs">
              Spending by category
            </CardDescription>
          </div>
          <div className="p-2.5 rounded-xl bg-rose-500/10 ring-1 ring-rose-500/20">
            <PieChartIcon className="h-4 w-4 text-rose-500" />
          </div>
        </CardHeader>
        <CardContent className="flex-1 flex items-center justify-center pb-4">
          <p className="text-sm text-muted-foreground">
            No expense data available
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="flex flex-col h-full border-border/50 bg-card/80 backdrop-blur-sm shadow-sm hover:shadow-md transition-shadow duration-200">
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-4">
        <div className="flex-1">
          <div className="flex items-center justify-between mb-2">
            <CardTitle className="text-base font-semibold">
              Expense Breakdown
            </CardTitle>
            {allChartData.length > 5 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-xs px-2"
                onClick={() => setShowAll(!showAll)}
              >
                {showAll ? "Top 5" : "View All"}
              </Button>
            )}
          </div>
          <CardDescription className="text-xs">
            Spending by category
          </CardDescription>
        </div>
        <div className="p-2.5 rounded-xl bg-rose-500/10 ring-1 ring-rose-500/20">
          <PieChartIcon className="h-4 w-4 text-rose-500" />
        </div>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col pb-4">
        <ChartContainer
          config={chartConfig}
          className="mx-auto aspect-square w-full max-h-[180px]"
        >
          <PieChart>
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  hideLabel
                  formatter={(value, _name, item) => (
                    <div className="flex flex-col gap-0.5">
                      <span className="font-medium">
                        {formatCurrencyCompact(value as number, "IDR")}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {item.payload.percentage.toFixed(1)}% of total
                      </span>
                    </div>
                  )}
                />
              }
            />
            <Pie
              data={chartData}
              dataKey="value"
              nameKey="name"
              innerRadius={50}
              outerRadius={80}
              strokeWidth={2}
              stroke="hsl(var(--background))"
              paddingAngle={2}
            >
              {chartData.map((entry) => (
                <Cell
                  key={`cell-${entry.name}`}
                  fill={entry.fill}
                  className="transition-opacity duration-200 hover:opacity-80"
                />
              ))}
              <Label
                content={({ viewBox }) => {
                  if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                    return (
                      <text
                        x={viewBox.cx}
                        y={viewBox.cy}
                        textAnchor="middle"
                        dominantBaseline="middle"
                      >
                        <tspan
                          x={viewBox.cx}
                          y={(viewBox.cy || 0) - 8}
                          className="fill-foreground text-sm font-bold"
                        >
                          {formatCurrencySmart(totalExpenses)}
                        </tspan>
                        <tspan
                          x={viewBox.cx}
                          y={(viewBox.cy || 0) + 10}
                          className="fill-muted-foreground text-[10px] font-medium"
                        >
                          Total Spent
                        </tspan>
                      </text>
                    );
                  }
                }}
              />
            </Pie>
          </PieChart>
        </ChartContainer>
        {/* Legend */}
        <div className="flex flex-wrap justify-center gap-x-4 gap-y-1.5 mt-3">
          {chartData.map((item) => (
            <div
              key={item.name}
              className="flex items-center gap-1.5 text-xs group/legend cursor-default"
            >
              <div
                className="h-2 w-2 rounded-full ring-1 ring-offset-1 ring-offset-background transition-transform duration-200 group-hover/legend:scale-125"
                style={{
                  backgroundColor: item.fill,
                  boxShadow: `0 0 6px ${item.fill}40`,
                }}
              />
              <span className="text-muted-foreground group-hover/legend:text-foreground transition-colors duration-200">
                {item.name}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
});

ExpenseBreakdownChart.displayName = "ExpenseBreakdownChart";

export { ExpenseBreakdownChart };

export const ExpenseBreakdownChartSkeleton = () => {
  return (
    <Card className="flex flex-col h-full">
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-4">
        <div>
          <CardTitle className="text-base font-semibold">
            Expense Breakdown
          </CardTitle>
          <CardDescription className="text-xs">
            Spending by category
          </CardDescription>
        </div>
        <div className="p-2.5 rounded-xl bg-rose-500/10 ring-1 ring-rose-500/20">
          <PieChartIcon className="h-4 w-4 text-rose-500" />
        </div>
      </CardHeader>
      <CardContent className="flex-1 flex items-center justify-center pb-4">
        <Skeleton className="aspect-square h-[180px] rounded-full" />
      </CardContent>
    </Card>
  );
};
