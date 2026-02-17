"use client";

import { useBudgetPeriod } from "@repo/common/hooks/use-budget-period";
import { useFilters } from "@repo/common/hooks/use-filters";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { AccountOverviewChartSkeleton } from "@/components/account-overview-chart";
import { BudgetVsActualChartSkeleton } from "@/components/budget-vs-actual-chart";
import { DateRangePicker } from "@/components/date-range-picker";
import { ExpenseBreakdownChartSkeleton } from "@/components/expense-breakdown-chart";
import { FinancialHealthSection } from "@/components/financial-health-section";
import { InsightsPanel } from "@/components/insights-panel";
import { MonthlyComparisonChartSkeleton } from "@/components/monthly-comparison-chart";
import { StatCardsSection } from "@/components/stat-cards-section";
import { TransactionTrendsChartSkeleton } from "@/components/transaction-trends-chart";

const AccountOverviewChart = dynamic(
  () =>
    import("@/components/account-overview-chart").then(
      (mod) => mod.AccountOverviewChart,
    ),
  {
    ssr: false,
    loading: () => <AccountOverviewChartSkeleton />,
  },
);

const ExpenseBreakdownChart = dynamic(
  () =>
    import("@/components/expense-breakdown-chart").then(
      (mod) => mod.ExpenseBreakdownChart,
    ),
  {
    ssr: false,
    loading: () => <ExpenseBreakdownChartSkeleton />,
  },
);

const TransactionTrendsChart = dynamic(
  () =>
    import("@/components/transaction-trends-chart").then(
      (mod) => mod.TransactionTrendsChart,
    ),
  {
    ssr: false,
    loading: () => <TransactionTrendsChartSkeleton />,
  },
);

const BudgetVsActualChart = dynamic(
  () =>
    import("@/components/budget-vs-actual-chart").then(
      (mod) => mod.BudgetVsActualChart,
    ),
  {
    ssr: false,
    loading: () => <BudgetVsActualChartSkeleton />,
  },
);

const MonthlyComparisonChart = dynamic(
  () =>
    import("@/components/monthly-comparison-chart").then(
      (mod) => mod.MonthlyComparisonChart,
    ),
  {
    ssr: false,
    loading: () => <MonthlyComparisonChartSkeleton />,
  },
);

export function DashboardContent() {
  const { month, year } = useBudgetPeriod((s) => ({
    month: s.month,
    year: s.year,
  }));

  const { range, setRange } = useFilters((s) => ({
    range: s.range,
    setRange: s.setRange,
  }));

  // Initialize range to last 3 months if not set
  useEffect(() => {
    if (!range) {
      setRange({
        from: new Date(
          month === 1 ? year - 1 : year,
          month === 1 ? 11 : month - 2,
          25,
        ),
        to: new Date(year, month - 1, 25),
      });
    }
  }, [month, year, range, setRange]);

  return (
    <div className="space-y-8 pb-12">
      {/* Header with Date Range Picker */}
      <div className="flex items-center justify-between -mx-6 px-6 py-5 -mt-6 border-b border-border/50">
        <DateRangePicker date={range} onDateChange={setRange} />
      </div>

      {/* Net Worth Section */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <div className="h-5 w-1 bg-primary rounded-full" />
          <h2 className="text-lg font-semibold text-foreground">Net Worth</h2>
        </div>
        <FinancialHealthSection range={range} />
      </section>

      {/* Overview Section */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <div className="h-5 w-1 bg-primary rounded-full" />
          <h2 className="text-lg font-semibold text-foreground">Overview</h2>
        </div>
        <StatCardsSection range={range} />
      </section>

      {/* Financial Trends Section */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <div className="h-5 w-1 bg-primary rounded-full" />
          <h2 className="text-lg font-semibold text-foreground">
            Financial Trends
          </h2>
        </div>
        <TransactionTrendsChart range={range} />
      </section>

      {/* Insights Section */}
      <section className="space-y-4">
        <InsightsPanel range={range} />
      </section>

      {/* Breakdown Section */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <div className="h-5 w-1 bg-primary rounded-full" />
          <h2 className="text-lg font-semibold text-foreground">Breakdown</h2>
        </div>
        <div className="grid gap-5 md:grid-cols-2">
          <AccountOverviewChart />
          <ExpenseBreakdownChart range={range} />
        </div>
      </section>

      {/* Budget Analysis Section */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <div className="h-5 w-1 bg-primary rounded-full" />
          <h2 className="text-lg font-semibold text-foreground">
            Budget Analysis
          </h2>
        </div>
        <div className="grid gap-5 md:grid-cols-2">
          <BudgetVsActualChart range={range} />
          <MonthlyComparisonChart range={range} />
        </div>
      </section>
    </div>
  );
}
