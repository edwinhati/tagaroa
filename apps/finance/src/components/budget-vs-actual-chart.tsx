"use client";

import { budgetPerformanceQueryOptions } from "@repo/common/lib/query/finance-dashboard";
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
import type { DateRange } from "react-day-picker";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

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

const BudgetVsActualChart = ({ range }: { range?: DateRange }) => {
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
      <Card className="col-span-3 h-full">
        <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
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
    })) ?? [];

  return (
    <Card className="col-span-3 h-full cursor-pointer group transition-all duration-300 hover:shadow-xl hover:shadow-primary/10 hover:-translate-y-1 border-border/50 hover:border-primary/30 bg-card/80 backdrop-blur-sm">
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
        <div>
          <CardTitle className="text-base font-semibold group-hover:text-primary transition-colors duration-200">
            Budget vs Actual
          </CardTitle>
          <CardDescription className="text-xs">{monthName}</CardDescription>
        </div>
        <div className="p-2.5 rounded-xl bg-amber-500/10 ring-1 ring-amber-500/20 group-hover:bg-amber-500/20 group-hover:scale-110 transition-all duration-200">
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
              content={<ChartTooltipContent indicator="dashed" />}
            />
            <Bar
              dataKey="allocated"
              fill="var(--color-allocated)"
              radius={[4, 4, 0, 0]}
              className="transition-opacity duration-200 hover:opacity-80"
            />
            <Bar
              dataKey="spent"
              fill="var(--color-spent)"
              radius={[4, 4, 0, 0]}
              className="transition-opacity duration-200 hover:opacity-80"
            />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
};

export { BudgetVsActualChart };

export const BudgetVsActualChartSkeleton = () => {
  return (
    <Card className="col-span-3 h-full">
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
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
