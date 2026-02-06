"use client";

import dynamic from "next/dynamic";
import { useBudgetPeriod } from "@repo/common/hooks/use-budget-period";
import { useFilters } from "@repo/common/hooks/use-filters";
import { useEffect } from "react";
import { AccountOverviewChartSkeleton } from "@/components/account-overview-chart";

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

import {
  BudgetVsActualChart,
  BudgetVsActualChartSkeleton,
} from "@/components/budget-vs-actual-chart";
import { DateRangePicker } from "@/components/date-range-picker";
import { ExpenseBreakdownChartSkeleton } from "@/components/expense-breakdown-chart";
import {
  MonthlyComparisonChart,
  MonthlyComparisonChartSkeleton,
} from "@/components/monthly-comparison-chart";
import { StatCardsSection } from "@/components/stat-cards-section";
import { TransactionTrendsChartSkeleton } from "@/components/transaction-trends-chart";

export function DashboardContent() {
  const { month, year } = useBudgetPeriod((s) => ({
    month: s.month,
    year: s.year,
  }));

  const { range, setRange } = useFilters((s) => ({
    range: s.range,
    setRange: s.setRange,
  }));

  // Initialize range from budget period if not set
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <DateRangePicker date={range} onDateChange={setRange} />
      </div>

      <StatCardsSection range={range} />

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <div className="col-span-1">
          <AccountOverviewChart />
        </div>
        <div className="col-span-1">
          <ExpenseBreakdownChart range={range} />
        </div>
        <div className="col-span-1">
          <TransactionTrendsChart range={range} />
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="col-span-1">
          <BudgetVsActualChart range={range} />
        </div>
        <div className="col-span-1">
          <MonthlyComparisonChart range={range} />
        </div>
      </div>
    </div>
  );
}
