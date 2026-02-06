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
import { Wallet } from "lucide-react";
import { useMemo } from "react";
import { Cell, Label, Pie, PieChart } from "recharts";
import { formatCurrencySmart } from "@/utils/currency";

export const description = "A donut chart showing account balances by type";

// Premium color palette for fintech dashboard
const CHART_COLORS = [
  "hsl(217, 91%, 60%)", // Vibrant blue
  "hsl(142, 76%, 36%)", // Emerald green
  "hsl(38, 92%, 50%)", // Amber/gold
  "hsl(280, 87%, 65%)", // Purple
  "hsl(349, 89%, 60%)", // Rose red
];

const AccountOverviewChart = () => {
  const { data, isLoading } = useQuery(accountAggregationsQueryOptions());

  const chartData = useMemo(() => {
    return (
      data?.by_type.map((item, index) => ({
        name:
          item.type.charAt(0).toUpperCase() +
          item.type.slice(1).toLowerCase().replace(/-/g, " "),
        value: item.balance,
        fill: CHART_COLORS[index % CHART_COLORS.length],
      })) ?? []
    );
  }, [data]);

  const chartConfig = useMemo(() => {
    const config: ChartConfig = {
      value: { label: "Balance" },
    };
    chartData.forEach((item, index) => {
      config[item.name.toLowerCase().replace(/\s/g, "")] = {
        label: item.name,
        color: CHART_COLORS[index % CHART_COLORS.length],
      };
    });
    return config;
  }, [chartData]);

  const totalBalance = useMemo(() => {
    return chartData.reduce((sum, item) => sum + item.value, 0);
  }, [chartData]);

  if (isLoading) {
    return (
      <Card className="flex flex-col h-full">
        <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
          <div>
            <CardTitle className="text-base font-semibold">
              Account Overview
            </CardTitle>
            <CardDescription className="text-xs">
              Balance by account type
            </CardDescription>
          </div>
          <div className="p-2.5 rounded-xl bg-blue-500/10 ring-1 ring-blue-500/20">
            <Wallet className="h-4 w-4 text-blue-500" />
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
        <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
          <div>
            <CardTitle className="text-base font-semibold">
              Account Overview
            </CardTitle>
            <CardDescription className="text-xs">
              Balance by account type
            </CardDescription>
          </div>
          <div className="p-2.5 rounded-xl bg-blue-500/10 ring-1 ring-blue-500/20">
            <Wallet className="h-4 w-4 text-blue-500" />
          </div>
        </CardHeader>
        <CardContent className="flex-1 flex items-center justify-center pb-4">
          <p className="text-sm text-muted-foreground">
            No account data available
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="flex flex-col h-full cursor-pointer group transition-all duration-300 hover:shadow-xl hover:shadow-primary/10 hover:-translate-y-1 border-border/50 hover:border-primary/30 bg-card/80 backdrop-blur-sm">
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
        <div>
          <CardTitle className="text-base font-semibold group-hover:text-primary transition-colors duration-200">
            Account Overview
          </CardTitle>
          <CardDescription className="text-xs">
            Balance by account type
          </CardDescription>
        </div>
        <div className="p-2.5 rounded-xl bg-blue-500/10 ring-1 ring-blue-500/20 group-hover:bg-blue-500/20 group-hover:scale-110 transition-all duration-200">
          <Wallet className="h-4 w-4 text-blue-500" />
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
              content={<ChartTooltipContent hideLabel />}
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
                          {formatCurrencySmart(totalBalance)}
                        </tspan>
                        <tspan
                          x={viewBox.cx}
                          y={(viewBox.cy || 0) + 10}
                          className="fill-muted-foreground text-[10px] font-medium"
                        >
                          Total Balance
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
};

export { AccountOverviewChart };

export const AccountOverviewChartSkeleton = () => {
  return (
    <Card className="flex flex-col h-full">
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
        <div>
          <CardTitle className="text-base font-semibold">
            Account Overview
          </CardTitle>
          <CardDescription className="text-xs">
            Balance by account type
          </CardDescription>
        </div>
        <div className="p-2.5 rounded-xl bg-blue-500/10 ring-1 ring-blue-500/20">
          <Wallet className="h-4 w-4 text-blue-500" />
        </div>
      </CardHeader>
      <CardContent className="flex-1 flex items-center justify-center pb-4">
        <Skeleton className="aspect-square h-[180px] rounded-full" />
      </CardContent>
    </Card>
  );
};
