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
  CircleDollarSign,
  PiggyBank,
  Receipt,
  XCircle,
} from "lucide-react";
import React from "react";
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

const StatCard: React.FC<StatCardProps> = React.memo(
  ({ title, value, change, trend, icon, iconBgColor, className }) => {
    return (
      <Card
        className={cn(
          "relative cursor-pointer group",
          "transition-all duration-300 ease-out",
          "hover:shadow-xl hover:shadow-primary/10",
          "hover:-translate-y-1",
          "border-border/50 hover:border-primary/30",
          "bg-card/80 backdrop-blur-sm",
          className,
        )}
      >
        <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
          <p className="text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors duration-200">
            {title}
          </p>
          {icon && (
            <div
              className={cn(
                "flex items-center justify-center transition-all duration-200 group-hover:scale-110",
                "ring-1 ring-current/20",
                iconBgColor,
              )}
            >
              {icon}
            </div>
          )}
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold tracking-tight group-hover:text-primary transition-colors duration-200">
            {value}
          </div>
          {change && (
            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1.5">
              {trend === "up" && (
                <span className="flex items-center gap-0.5 text-emerald-500 font-medium">
                  <ArrowUpRight className="h-3 w-3" />
                  {change}
                </span>
              )}
              {trend === "down" && (
                <span className="flex items-center gap-0.5 text-rose-500 font-medium">
                  <ArrowDownRight className="h-3 w-3" />
                  {change}
                </span>
              )}
              {trend === "neutral" && (
                <span className="font-medium text-muted-foreground">
                  {change}
                </span>
              )}
              <span className="text-muted-foreground/80">from last period</span>
            </p>
          )}
        </CardContent>
      </Card>
    );
  },
);

StatCard.displayName = "StatCard";

const StatCardSkeleton: React.FC = React.memo(() => (
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
));

StatCardSkeleton.displayName = "StatCardSkeleton";

const StatCardsSection: React.FC<StatCardsSectionProps> = React.memo(
  ({ range }) => {
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
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
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
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Income"
          value={formatCurrency(summary?.income.amount ?? 0, "IDR")}
          change={`${(summary?.income_comparison.change ?? 0) > 0 ? "+" : ""}${(
            summary?.income_comparison.change ?? 0
          ).toFixed(2)}`}
          trend={incomeTrend}
          icon={<CircleDollarSign className="h-4 w-4" />}
          iconBgColor="text-emerald-500 bg-emerald-500/10 rounded-xl p-2.5"
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
        />
        <StatCard
          title="Budget Utilization"
          value={`${(budget?.overall_percentage ?? 0).toFixed(1)}%`}
          icon={getBudgetIcon({ percentage: budget?.overall_percentage ?? 0 })}
          iconBgColor={cn(
            "rounded-xl p-2.5",
            (budget?.overall_percentage ?? 0) < 70 &&
              "text-emerald-500 bg-emerald-500/10",
            (budget?.overall_percentage ?? 0) >= 70 &&
              (budget?.overall_percentage ?? 0) < 90 &&
              "text-amber-500 bg-amber-500/10",
            (budget?.overall_percentage ?? 0) >= 90 &&
              "text-rose-500 bg-rose-500/10",
          )}
        />
      </div>
    );
  },
);

StatCardsSection.displayName = "StatCardsSection";

export { StatCardsSection };

function getBudgetIcon({ percentage }: { percentage: number }) {
  if (percentage < 70) return <CheckCircle2 className="h-4 w-4" />;
  if (percentage < 90) return <AlertTriangle className="h-4 w-4" />;
  return <XCircle className="h-4 w-4" />;
}
