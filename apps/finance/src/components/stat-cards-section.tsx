"use client";

import {
  dashboardSummaryQueryOptions,
  transactionTrendsQueryOptions,
} from "@repo/common/lib/query/finance-dashboard-query";
import { Card, CardContent, CardHeader } from "@repo/ui/components/card";
import { Skeleton } from "@repo/ui/components/skeleton";
import { cn } from "@repo/ui/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { format, subMonths } from "date-fns";
import {
  ArrowDownRight,
  ArrowUpRight,
  CircleDollarSign,
  PiggyBank,
  Receipt,
} from "lucide-react";
import type { DateRange } from "react-day-picker";
import { formatCurrency } from "@/utils/currency";
import { MiniSparkline } from "./mini-sparkline";

interface StatCardsSectionProps {
  range?: DateRange;
}

interface StatCardProps {
  title: string;
  value: string;
  change?: string;
  trend?: "up" | "down" | "neutral";
  icon?: React.ReactNode;
  iconBgColor?: string;
  sparklineData?: { value: number }[];
  className?: string;
}

const StatCard = ({
  title,
  value,
  change,
  trend,
  icon,
  iconBgColor,
  sparklineData,
  className,
}: StatCardProps) => {
  return (
    <Card
      className={cn(
        "relative overflow-hidden",
        "border-border/50",
        "bg-card/80 backdrop-blur-sm",
        "shadow-sm",
        "transition-shadow duration-200 hover:shadow-md",
        className,
      )}
    >
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          {title}
        </p>
        {icon && (
          <div
            className={cn(
              "flex items-center justify-center shrink-0",
              "ring-2 ring-current/20",
              iconBgColor,
            )}
          >
            {icon}
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-2.5 pt-0">
        <div className="text-2xl font-bold tracking-tight text-foreground">
          {value}
        </div>
        {change && (
          <p className="text-xs flex items-center gap-1.5">
            {trend === "up" && (
              <span className="flex items-center gap-0.5 text-emerald-600 font-bold">
                <ArrowUpRight className="h-4 w-4" />
                {change}
              </span>
            )}
            {trend === "down" && (
              <span className="flex items-center gap-0.5 text-rose-600 font-bold">
                <ArrowDownRight className="h-4 w-4" />
                {change}
              </span>
            )}
            {trend === "neutral" && (
              <span className="font-bold text-slate-500">{change}</span>
            )}
            <span className="text-slate-500 font-medium">from last period</span>
          </p>
        )}
        {sparklineData && sparklineData.length > 0 && (
          <div className="pt-1">
            <MiniSparkline
              data={sparklineData}
              className="h-10 w-full"
              color={
                trend === "up"
                  ? "hsl(142, 76%, 36%)"
                  : trend === "down"
                    ? "hsl(349, 89%, 60%)"
                    : "hsl(var(--muted-foreground))"
              }
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
};

const StatCardSkeleton = () => (
  <Card className="bg-card/80 backdrop-blur-sm">
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-9 w-9 rounded-xl" />
    </CardHeader>
    <CardContent>
      <Skeleton className="h-8 w-32 mb-2" />
      <Skeleton className="h-3 w-40" />
    </CardContent>
  </Card>
);

export function StatCardsSection({ range }: StatCardsSectionProps) {
  const { data: summary, isLoading: summaryLoading } = useQuery({
    ...dashboardSummaryQueryOptions({
      startDate: range?.from ? format(range.from, "yyyy-MM-dd") : undefined,
      endDate: range?.to ? format(range.to, "yyyy-MM-dd") : undefined,
    }),
  });

  // Fetch 6-month trend data for sparklines
  const sixMonthsAgo = subMonths(new Date(), 6);
  const { data: trendData, isLoading: trendLoading } = useQuery({
    ...transactionTrendsQueryOptions({
      startDate: format(sixMonthsAgo, "yyyy-MM-dd"),
      endDate: format(new Date(), "yyyy-MM-dd"),
    }),
  });

  const isLoading = summaryLoading || trendLoading;

  if (isLoading) {
    return (
      <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
        <StatCardSkeleton />
        <StatCardSkeleton />
        <StatCardSkeleton />
      </div>
    );
  }

  const savingsTrend =
    (summary?.savings_comparison.change ?? 0) > 0
      ? "up"
      : (summary?.savings_comparison.change ?? 0) < 0
        ? "down"
        : "neutral";

  const incomeTrend =
    (summary?.income_comparison.change ?? 0) > 0
      ? "up"
      : (summary?.income_comparison.change ?? 0) < 0
        ? "down"
        : "neutral";

  const expenseTrend =
    (summary?.expense_comparison.change ?? 0) > 0
      ? "down"
      : (summary?.expense_comparison.change ?? 0) < 0
        ? "up"
        : "neutral";

  // Prepare sparkline data from trends
  const incomeSparkline =
    trendData?.trends.map((t) => ({ value: t.income })) ?? [];
  const expenseSparkline =
    trendData?.trends.map((t) => ({ value: t.expenses })) ?? [];
  const savingsSparkline =
    trendData?.trends.map((t) => ({ value: t.net_flow })) ?? [];

  return (
    <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
      <StatCard
        title="Total Income"
        value={formatCurrency(summary?.income.amount ?? 0, "IDR")}
        change={`${(summary?.income_comparison.change ?? 0) > 0 ? "+" : ""}${(
          summary?.income_comparison.change ?? 0
        ).toFixed(2)}`}
        trend={incomeTrend}
        icon={<CircleDollarSign className="h-4 w-4" />}
        iconBgColor="text-emerald-500 bg-emerald-500/10 rounded-xl p-2.5"
        sparklineData={incomeSparkline}
      />
      <StatCard
        title="Total Expenses"
        value={formatCurrency(summary?.expenses.amount ?? 0, "IDR")}
        change={`${(summary?.expense_comparison.change ?? 0) > 0 ? "+" : ""}${(
          summary?.expense_comparison.change ?? 0
        ).toFixed(2)}`}
        trend={expenseTrend}
        icon={<Receipt className="h-4 w-4" />}
        iconBgColor="text-rose-500 bg-rose-500/10 rounded-xl p-2.5"
        sparklineData={expenseSparkline}
      />
      <StatCard
        title="Net Savings"
        value={formatCurrency(summary?.savings.amount ?? 0, "IDR")}
        change={`${(summary?.savings_comparison.change ?? 0) > 0 ? "+" : ""}${(
          summary?.savings_comparison.change ?? 0
        ).toFixed(2)}`}
        trend={savingsTrend}
        icon={<PiggyBank className="h-4 w-4" />}
        iconBgColor={cn(
          "rounded-xl p-2.5",
          savingsTrend === "up" && "text-emerald-500 bg-emerald-500/10",
          savingsTrend === "down" && "text-rose-500 bg-rose-500/10",
          savingsTrend === "neutral" && "text-muted-foreground bg-muted",
        )}
        sparklineData={savingsSparkline}
      />
    </div>
  );
}
