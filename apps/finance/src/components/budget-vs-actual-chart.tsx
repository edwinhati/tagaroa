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
import { GitCompare } from "lucide-react";
import type { DateRange } from "react-day-picker";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

const chartConfig = {
  allocated: {
    label: "Allocated",
    color: "var(--chart-1)",
  },
  spent: {
    label: "Spent",
    color: "var(--chart-2)",
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
      <Card className="col-span-3">
        <CardHeader>
          <div className="flex items-center gap-2">
            <GitCompare className="h-5 w-5 text-muted-foreground" />
            <CardTitle>Budget vs Actual</CardTitle>
          </div>
          <CardDescription>{monthName}</CardDescription>
        </CardHeader>
        <CardContent className="pl-2">
          <Skeleton className="h-[300px] w-full" />
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
    <Card className="col-span-3">
      <CardHeader>
        <div className="flex items-center gap-2">
          <GitCompare className="h-5 w-5 text-muted-foreground" />
          <CardTitle>Budget vs Actual</CardTitle>
        </div>
        <CardDescription>{monthName}</CardDescription>
      </CardHeader>
      <CardContent className="pl-2">
        <ChartContainer config={chartConfig} className="h-[300px] w-full">
          <BarChart data={chartData} accessibilityLayer>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="category"
              tickLine={false}
              tickMargin={10}
              axisLine={false}
              tickFormatter={(value) =>
                value.length > 8 ? `${value.slice(0, 8)}...` : value
              }
            />
            <YAxis hide />
            <ChartTooltip
              content={<ChartTooltipContent indicator="dashed" />}
            />
            <Bar dataKey="allocated" fill="var(--color-allocated)" radius={4} />
            <Bar dataKey="spent" fill="var(--color-spent)" radius={4} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
};

export { BudgetVsActualChart };
