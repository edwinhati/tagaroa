"use client";

import { accountAggregationsQueryOptions } from "@repo/common/lib/query/finance-dashboard";
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
import { Building2 } from "lucide-react";
import { useMemo } from "react";
import { Label, Pie, PieChart } from "recharts";
import { formatCurrency } from "@/utils/currency";

export const description = "A donut chart showing account balances by type";

const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

const AccountOverviewChart = () => {
  const { data, isLoading } = useQuery(accountAggregationsQueryOptions());

  const chartData = useMemo(() => {
    return (
      data?.by_type.map((item, index) => ({
        type: item.type,
        balance: item.balance,
        fill: CHART_COLORS[index % CHART_COLORS.length],
      })) ?? []
    );
  }, [data]);

  const chartConfig = useMemo(() => {
    const config: ChartConfig = {
      balance: { label: "Balance" },
    };
    chartData.forEach((item, index) => {
      config[item.type] = {
        label: item.type.charAt(0) + item.type.slice(1).toLowerCase(),
        color: CHART_COLORS[index % CHART_COLORS.length],
      };
    });
    return config;
  }, [chartData]);

  const totalBalance = useMemo(() => {
    return chartData.reduce((sum, item) => sum + item.balance, 0);
  }, [chartData]);

  if (isLoading) {
    return (
      <Card className="flex flex-col">
        <CardHeader className="items-center pb-0">
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-muted-foreground" />
            <CardTitle>Account Overview</CardTitle>
          </div>
          <CardDescription>Balance by account type</CardDescription>
        </CardHeader>
        <CardContent className="flex-1">
          <Skeleton className="mx-auto h-[200px] w-[200px] rounded-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="flex flex-col">
      <CardHeader className="items-center pb-0">
        <div className="flex items-center gap-2">
          <Building2 className="h-5 w-5 text-muted-foreground" />
          <CardTitle>Account Overview</CardTitle>
        </div>
        <CardDescription>Balance by account type</CardDescription>
      </CardHeader>
      <CardContent className="flex-1">
        <ChartContainer
          config={chartConfig}
          className="mx-auto h-[200px] w-full"
        >
          <PieChart accessibilityLayer>
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent hideLabel />}
            />
            <Pie
              data={chartData}
              dataKey="balance"
              nameKey="type"
              innerRadius={60}
              strokeWidth={5}
            >
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
                          y={viewBox.cy}
                          className="fill-foreground text-xl font-bold"
                        >
                          {formatCurrency(totalBalance)}
                        </tspan>
                        <tspan
                          x={viewBox.cx}
                          y={(viewBox.cy || 0) + 24}
                          className="fill-muted-foreground"
                        >
                          Total
                        </tspan>
                      </text>
                    );
                  }
                }}
              />
            </Pie>
          </PieChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
};

export { AccountOverviewChart };
