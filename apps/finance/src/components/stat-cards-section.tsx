"use client";

import { useBudgetPeriod } from "@repo/common/hooks/use-budget-period";
import {
  budgetPerformanceQueryOptions,
  dashboardSummaryQueryOptions,
} from "@repo/common/lib/query/finance-dashboard";
import { Card, CardContent, CardHeader } from "@repo/ui/components/card";
import { Skeleton } from "@repo/ui/components/skeleton";
import { cn } from "@repo/ui/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  CreditCard,
  TrendingUp,
  Wallet,
  XCircle,
} from "lucide-react";
import type { DateRange } from "react-day-picker";
import { formatCurrency } from "@/utils/currency";

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
  className?: string;
}

const StatCard = ({
  title,
  value,
  change,
  trend,
  icon,
  iconBgColor,
  className,
}: StatCardProps) => {
  return (
    <Card className={cn("relative", className)}>
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
        <p className="text-sm font-medium">{title}</p>
        {icon && (
          <div className={cn("flex items-center justify-center", iconBgColor)}>
            {icon}
          </div>
        )}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {change && (
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            {trend === "up" && (
              <ArrowUpRight className="h-3 w-3 text-green-500" />
            )}
            {trend === "down" && (
              <ArrowDownRight className="h-3 w-3 text-red-500" />
            )}
            <span
              className={cn(
                trend === "up" && "text-green-500",
                trend === "down" && "text-red-500",
              )}
            >
              {change}
            </span>{" "}
            from last period
          </p>
        )}
      </CardContent>
    </Card>
  );
};

const StatCardSkeleton = () => (
  <Card>
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-4 w-4 rounded" />
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

  const { month, year } = useBudgetPeriod((s) => ({
    month: s.month,
    year: s.year,
  }));

  const { data: budget, isLoading: budgetLoading } = useQuery({
    ...budgetPerformanceQueryOptions({
      month,
      year,
    }),
  });

  const isLoading = summaryLoading || budgetLoading;

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCardSkeleton />
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

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <StatCard
        title="Total Income"
        value={formatCurrency(summary?.income.amount ?? 0, "IDR")}
        change={`${(summary?.income_comparison.change ?? 0) > 0 ? "+" : ""}${(
          summary?.income_comparison.change ?? 0
        ).toFixed(2)}`}
        trend={incomeTrend}
        icon={<Wallet className="h-4 w-4" />}
        iconBgColor="text-green-500 bg-green-50 rounded-full p-1"
      />
      <StatCard
        title="Total Expenses"
        value={formatCurrency(summary?.expenses.amount ?? 0, "IDR")}
        change={`${(summary?.expense_comparison.change ?? 0) > 0 ? "+" : ""}${(
          summary?.expense_comparison.change ?? 0
        ).toFixed(2)}`}
        trend={expenseTrend}
        icon={<CreditCard className="h-4 w-4" />}
        iconBgColor="text-red-500 bg-red-50 rounded-full p-1"
      />
      <StatCard
        title="Net Savings"
        value={formatCurrency(summary?.savings.amount ?? 0, "IDR")}
        change={`${(summary?.savings_comparison.change ?? 0) > 0 ? "+" : ""}${(
          summary?.savings_comparison.change ?? 0
        ).toFixed(2)}`}
        trend={savingsTrend}
        icon={<TrendingUp className="h-4 w-4" />}
        iconBgColor={cn(
          "rounded-full p-1",
          savingsTrend === "up" && "text-green-500 bg-green-50",
          savingsTrend === "down" && "text-red-500 bg-red-50",
          savingsTrend === "neutral" && "text-muted-foreground bg-muted",
        )}
      />
      <StatCard
        title="Budget Utilization"
        value={`${(budget?.overall_percentage ?? 0).toFixed(1)}%`}
        icon={getBudgetIcon({ percentage: budget?.overall_percentage ?? 0 })}
        iconBgColor={cn(
          "rounded-full p-1",
          (budget?.overall_percentage ?? 0) < 70 &&
            "text-green-500 bg-green-50",
          (budget?.overall_percentage ?? 0) >= 70 &&
            (budget?.overall_percentage ?? 0) < 90 &&
            "text-yellow-500 bg-yellow-50",
          (budget?.overall_percentage ?? 0) >= 90 && "text-red-500 bg-red-50",
        )}
      />
    </div>
  );
}

function getBudgetIcon({ percentage }: { percentage: number }) {
  if (percentage < 70) return <CheckCircle2 className="h-4 w-4" />;
  if (percentage < 90) return <AlertTriangle className="h-4 w-4" />;
  return <XCircle className="h-4 w-4" />;
}
