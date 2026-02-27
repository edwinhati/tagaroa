"use client";

import { insightsQueryOptions } from "@repo/common/lib/query/finance-dashboard-query";
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
import {
  IconAlertCircle,
  IconArrowDownRight,
  IconArrowUpRight,
  IconBulb,
  IconEqual,
  IconSparkles,
  IconTrendingDown,
  IconTrendingUp,
} from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
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
  currency?: string;
}

// ─── Savings Rate Gauge ────────────────────────────────────────────────────

const SavingsRateGauge = ({
  rate,
  trend,
}: {
  rate: number;
  trend: "up" | "down" | "stable";
}) => {
  const percentage = Math.min(Math.max(rate, 0), 100);

  const getRateColor = () => {
    if (percentage >= 20) return "hsl(142, 76%, 36%)";
    if (percentage >= 10) return "hsl(38, 92%, 50%)";
    return "hsl(349, 89%, 60%)";
  };

  const getRateLabel = () => {
    if (percentage >= 20) return "On track";
    if (percentage >= 10) return "Below target";
    return "Needs attention";
  };

  const chartData = [{ rate: percentage, fill: getRateColor() }];
  const chartConfig = {
    rate: { label: "Savings Rate", color: getRateColor() },
  } satisfies ChartConfig;

  const TrendIcon =
    trend === "up"
      ? IconArrowUpRight
      : trend === "down"
        ? IconArrowDownRight
        : IconEqual;

  const trendColor =
    trend === "up"
      ? "text-emerald-500"
      : trend === "down"
        ? "text-rose-500"
        : "text-muted-foreground";

  const trendLabel =
    trend === "up" ? "Improving" : trend === "down" ? "Declining" : "Stable";

  return (
    <div className="flex items-center gap-4 p-4 rounded-xl bg-muted/30 border border-border/40">
      <ChartContainer
        config={chartConfig}
        className="aspect-square h-[72px] w-[72px] shrink-0"
        aria-label={`Savings rate: ${percentage.toFixed(0)}%, ${trendLabel.toLowerCase()}`}
      >
        <RadialBarChart
          data={chartData}
          startAngle={90}
          endAngle={90 - (360 * percentage) / 100}
          innerRadius={26}
          outerRadius={36}
        >
          <PolarGrid
            gridType="circle"
            radialLines={false}
            stroke="none"
            className="first:fill-muted last:fill-background"
            polarRadius={[36, 26]}
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
                        className="fill-foreground text-[11px] font-bold"
                      >
                        {percentage.toFixed(0)}%
                      </tspan>
                    </text>
                  );
                }
              }}
            />
          </PolarRadiusAxis>
          <RadialBar dataKey="rate" cornerRadius={6} />
        </RadialBarChart>
      </ChartContainer>

      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-foreground">Savings Rate</p>
        <div className="flex items-center gap-1 mt-0.5">
          <TrendIcon className={cn("h-3.5 w-3.5", trendColor)} />
          <span className={cn("text-xs font-medium", trendColor)}>
            {trendLabel}
          </span>
        </div>
        <p className="text-xs text-muted-foreground mt-1">{getRateLabel()}</p>
      </div>
    </div>
  );
};

// ─── Progress-bar item row ─────────────────────────────────────────────────

const ProgressItem = ({
  category,
  amount,
  percentage,
  type,
  currency = "IDR",
}: {
  category: string;
  amount: number;
  percentage: number;
  type: "income" | "expense";
  currency?: string;
}) => {
  const barColor = type === "income" ? "bg-emerald-500" : "bg-rose-500";
  const textColor =
    type === "income"
      ? "text-emerald-600 dark:text-emerald-400"
      : "text-rose-600 dark:text-rose-400";

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-foreground truncate max-w-[100px]">
          {category}
        </span>
        <div className="text-right shrink-0">
          <span className={cn("text-xs font-semibold tabular-nums", textColor)}>
            {formatCurrencyCompact(amount, currency)}
          </span>
          <span className="text-xs text-muted-foreground ml-1.5">
            {percentage.toFixed(1)}%
          </span>
        </div>
      </div>
      <div
        role="meter"
        aria-valuenow={percentage}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${category}: ${percentage.toFixed(1)}% of ${type === "expense" ? "expenses" : "income"}`}
        className="h-1.5 w-full rounded-full bg-muted overflow-hidden"
      >
        <div
          className={cn(
            "h-full rounded-full motion-safe:transition-all",
            barColor,
          )}
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>
    </div>
  );
};

// ─── Top Items Section ─────────────────────────────────────────────────────

const TopItemsSection = ({
  items,
  title,
  type,
  currency,
}: {
  items: { category: string; amount: number; percentage: number }[];
  title: string;
  type: "income" | "expense";
  currency?: string;
}) => {
  if (!items || items.length === 0) return null;

  const Icon = type === "income" ? IconTrendingUp : IconTrendingDown;
  const iconColor = type === "income" ? "text-emerald-500" : "text-rose-500";

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1.5">
        <Icon className={cn("h-3.5 w-3.5 shrink-0", iconColor)} />
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </h4>
      </div>
      <div className="space-y-3">
        {items.slice(0, 3).map((item) => (
          <ProgressItem
            key={item.category}
            category={item.category}
            amount={item.amount}
            percentage={item.percentage}
            type={type}
            currency={currency}
          />
        ))}
      </div>
    </div>
  );
};

// ─── Recommendations ───────────────────────────────────────────────────────

const RecommendationsList = ({
  recommendations,
}: {
  recommendations: string[];
}) => {
  if (!recommendations || recommendations.length === 0) return null;

  return (
    <div className="space-y-2">
      {recommendations.slice(0, 3).map((rec) => (
        <div key={rec} className="flex items-start gap-2.5">
          <div className="mt-0.5 shrink-0 h-5 w-5 rounded-full bg-amber-500/10 flex items-center justify-center">
            <IconBulb className="h-3 w-3 text-amber-500" />
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">{rec}</p>
        </div>
      ))}
    </div>
  );
};

// ─── Loading skeleton ──────────────────────────────────────────────────────

const LoadingSkeleton = () => (
  <Card className="h-full border-border/40 bg-card/60 backdrop-blur-md shadow-sm">
    <CardHeader className="pb-3">
      <Skeleton className="h-4 w-40" />
      <Skeleton className="h-3 w-32 mt-1" />
    </CardHeader>
    <CardContent className="space-y-5">
      <Skeleton className="h-[72px] w-full rounded-xl" />
      <div className="space-y-2">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-8 w-full" />
      </div>
      <div className="space-y-2.5">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
      </div>
    </CardContent>
  </Card>
);

// ─── Main Component ────────────────────────────────────────────────────────

export function InsightsPanel({ range, currency }: InsightsPanelProps) {
  const startDate = range?.from
    ? format(range.from, "yyyy-MM-dd")
    : format(new Date(), "yyyy-MM-dd");
  const endDate = range?.to
    ? format(range.to, "yyyy-MM-dd")
    : format(new Date(), "yyyy-MM-dd");

  const { data, isLoading, isError } = useQuery(
    insightsQueryOptions({ startDate, endDate }),
  );

  if (isLoading) return <LoadingSkeleton />;

  if (isError) {
    return (
      <Card className="h-full border-border/40 bg-card/60 backdrop-blur-md shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <IconAlertCircle className="h-4 w-4 text-violet-500" />
            Insights
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <p className="text-sm text-muted-foreground text-center">
            Unable to load insights
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  const hasExpenses = data.top_expenses && data.top_expenses.length > 0;
  const hasIncome =
    data.top_income_sources && data.top_income_sources.length > 0;
  const hasRecommendations =
    data.recommendations && data.recommendations.length > 0;

  return (
    <Card className="h-full border-border/40 bg-card/60 backdrop-blur-md shadow-sm flex flex-col">
      <CardHeader className="pb-3 shrink-0">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-violet-500/10">
            <IconSparkles className="h-3.5 w-3.5 text-violet-500" />
          </div>
          Insights
        </CardTitle>
        <CardDescription className="text-xs">
          AI-powered financial analysis
        </CardDescription>
      </CardHeader>

      <CardContent className="flex-1 overflow-y-auto space-y-5 pb-4">
        {/* Savings Rate */}
        <SavingsRateGauge
          rate={data.savings_rate}
          trend={data.savings_rate_trend}
        />

        {/* Top Expenses */}
        {hasExpenses && (
          <>
            <div className="h-px bg-border/40" />
            <TopItemsSection
              items={data.top_expenses}
              title="Top Expenses"
              type="expense"
              currency={currency}
            />
          </>
        )}

        {/* Top Income Sources */}
        {hasIncome && (
          <>
            <div className="h-px bg-border/40" />
            <TopItemsSection
              items={data.top_income_sources}
              title="Top Income"
              type="income"
            />
          </>
        )}

        {/* Recommendations */}
        {hasRecommendations && (
          <>
            <div className="h-px bg-border/40" />
            <div className="space-y-3">
              <div className="flex items-center gap-1.5">
                <IconBulb className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Recommendations
                </h4>
              </div>
              <RecommendationsList recommendations={data.recommendations} />
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
