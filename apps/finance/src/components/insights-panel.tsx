"use client";

import { insightsQueryOptions } from "@repo/common/lib/query/finance-dashboard-query";
import { Badge } from "@repo/ui/components/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card";
import { ChartConfig, ChartContainer } from "@repo/ui/components/chart";
import { Skeleton } from "@repo/ui/components/skeleton";
import { cn } from "@repo/ui/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  AlertCircle,
  ArrowDownRight,
  ArrowUpRight,
  Lightbulb,
  Minus,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import type { DateRange } from "react-day-picker";
import {
  Label,
  PolarGrid,
  PolarRadiusAxis,
  RadialBar,
  RadialBarChart,
} from "recharts";
import { formatCurrencyCompact } from "@/utils/currency";

interface InsightsPanelProps {
  range?: DateRange;
}

const SavingsRateGauge = ({
  rate,
  trend,
}: {
  rate: number;
  trend: "up" | "down" | "stable";
}) => {
  const percentage = Math.min(Math.max(rate, 0), 100);

  const getTrendIcon = () => {
    if (trend === "up")
      return <ArrowUpRight className="h-4 w-4 text-emerald-500" />;
    if (trend === "down")
      return <ArrowDownRight className="h-4 w-4 text-rose-500" />;
    return <Minus className="h-4 w-4 text-muted-foreground" />;
  };

  const getRateColor = () => {
    if (percentage >= 20) return "hsl(142, 76%, 36%)"; // emerald-500
    if (percentage >= 10) return "hsl(38, 92%, 50%)"; // amber-500
    return "hsl(349, 89%, 60%)"; // rose-500
  };

  const chartData = [{ rate: percentage, fill: getRateColor() }];

  const chartConfig = {
    rate: {
      label: "Savings Rate",
      color: getRateColor(),
    },
  } satisfies ChartConfig;

  return (
    <div className="flex items-center justify-between p-5 rounded-lg border border-border/50 bg-muted/30">
      <div className="flex items-center gap-4">
        <ChartContainer
          config={chartConfig}
          className="mx-auto aspect-square w-28 h-28"
        >
          <RadialBarChart
            data={chartData}
            startAngle={90}
            endAngle={90 - (360 * percentage) / 100}
            innerRadius={45}
            outerRadius={60}
          >
            <PolarGrid
              gridType="circle"
              radialLines={false}
              stroke="none"
              className="first:fill-muted last:fill-background"
              polarRadius={[60, 45]}
            />
            <PolarRadiusAxis tick={false} tickLine={false} axisLine={false}>
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
                          className="fill-foreground text-2xl font-bold"
                        >
                          {percentage.toFixed(0)}%
                        </tspan>
                      </text>
                    );
                  }
                }}
              />
            </PolarRadiusAxis>
            <RadialBar dataKey="rate" cornerRadius={10} />
          </RadialBarChart>
        </ChartContainer>
        <div>
          <p className="text-base font-semibold text-foreground">
            Savings Rate
          </p>
          <div className="flex items-center gap-1.5 mt-1.5">
            {getTrendIcon()}
            <span className="text-sm text-slate-400">
              {trend === "up" && "Improving"}
              {trend === "down" && "Declining"}
              {trend === "stable" && "Stable"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

const RecommendationsList = ({
  recommendations,
}: {
  recommendations: string[];
}) => {
  if (!recommendations || recommendations.length === 0) {
    return (
      <div className="text-sm text-muted-foreground p-4 text-center">
        No recommendations at this time
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {recommendations.map((recommendation, index) => (
        <div
          // biome-ignore lint/suspicious/noArrayIndexKey: Recommendations are simple strings without IDs
          key={index}
          className="flex items-start gap-3 p-4 rounded-lg border border-border/50 bg-muted/20 hover:bg-muted/30 transition-colors"
        >
          <Lightbulb className="h-5 w-5 text-amber-500 mt-0.5 flex-shrink-0" />
          <p className="text-sm leading-relaxed text-foreground">
            {recommendation}
          </p>
        </div>
      ))}
    </div>
  );
};

const TopItemsList = ({
  items,
  title,
  type,
}: {
  items: { category: string; amount: number; percentage: number }[];
  title: string;
  type: "income" | "expense";
}) => {
  if (!items || items.length === 0) {
    return null;
  }

  const colorClass = type === "income" ? "text-emerald-500" : "text-rose-500";
  const Icon = type === "income" ? TrendingUp : TrendingDown;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-4">
        <Icon className={cn("h-5 w-5", colorClass)} />
        <h4 className="text-base font-semibold">{title}</h4>
      </div>
      <div className="space-y-2">
        {items.slice(0, 3).map((item) => (
          <div
            key={item.category}
            className="flex items-center justify-between p-3 rounded-lg bg-muted/20"
          >
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs font-medium">
                {item.category}
              </Badge>
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold">
                {formatCurrencyCompact(item.amount, "IDR")}
              </p>
              <p className="text-xs text-slate-400">
                {item.percentage.toFixed(1)}%
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const LoadingSkeleton = () => (
  <Card className="h-full">
    <CardHeader>
      <Skeleton className="h-5 w-48" />
      <Skeleton className="h-4 w-64 mt-1" />
    </CardHeader>
    <CardContent className="space-y-4">
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-32 w-full" />
      <Skeleton className="h-24 w-full" />
    </CardContent>
  </Card>
);

export function InsightsPanel({ range }: InsightsPanelProps) {
  const startDate = range?.from
    ? format(range.from, "yyyy-MM-dd")
    : format(new Date(), "yyyy-MM-dd");
  const endDate = range?.to
    ? format(range.to, "yyyy-MM-dd")
    : format(new Date(), "yyyy-MM-dd");

  const { data, isLoading, isError } = useQuery(
    insightsQueryOptions({
      startDate,
      endDate,
    }),
  );

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  if (isError) {
    return (
      <Card className="border-border/50 bg-card/80 backdrop-blur-sm shadow-sm hover:shadow-md transition-shadow duration-200">
        <CardHeader>
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-violet-500" />
            Insights & Recommendations
          </CardTitle>
          <CardDescription className="text-xs">
            AI-powered financial analysis
          </CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-12">
          <div className="text-center space-y-2">
            <p className="text-sm text-muted-foreground">
              Unable to load insights at this time
            </p>
            <p className="text-xs text-muted-foreground">
              Please check back later
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data) {
    return null;
  }

  return (
    <Card className="border-border/50 bg-card/80 backdrop-blur-sm shadow-sm hover:shadow-md transition-shadow duration-200">
      <CardHeader>
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-violet-500" />
          Insights & Recommendations
        </CardTitle>
        <CardDescription className="text-sm text-slate-400">
          AI-powered financial analysis
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-8 md:grid-cols-2">
          {/* Left Column */}
          <div className="space-y-6">
            {/* Savings Rate Gauge */}
            <SavingsRateGauge
              rate={data.savings_rate}
              trend={data.savings_rate_trend}
            />

            {/* Recommendations */}
            <div>
              <h4 className="text-sm font-semibold mb-4">Recommendations</h4>
              <RecommendationsList recommendations={data.recommendations} />
            </div>
          </div>

          {/* Right Column */}
          <div className="grid gap-6 sm:grid-cols-2">
            {/* Top Expenses */}
            {data.top_expenses && data.top_expenses.length > 0 && (
              <TopItemsList
                items={data.top_expenses}
                title="Top Expenses"
                type="expense"
              />
            )}

            {/* Top Income Sources */}
            {data.top_income_sources && data.top_income_sources.length > 0 && (
              <TopItemsList
                items={data.top_income_sources}
                title="Top Income Sources"
                type="income"
              />
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
