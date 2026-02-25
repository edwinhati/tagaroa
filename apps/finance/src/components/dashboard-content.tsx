"use client";

import { useFilters } from "@repo/common/hooks/use-filters";
import { useEffect } from "react";
import { AccountOverviewChart } from "@/components/account-overview-chart";
import { BudgetVsActualChart } from "@/components/budget-vs-actual-chart";
import { DateRangePicker } from "@/components/date-range-picker";
import { ExpenseBreakdownChart } from "@/components/expense-breakdown-chart";
import { FinancialHealthSection } from "@/components/financial-health-section";
import { InsightsPanel } from "@/components/insights-panel";
import { MonthlyComparisonChart } from "@/components/monthly-comparison-chart";
import { StatCardsSection } from "@/components/stat-cards-section";
import { TransactionTrendsChart } from "@/components/transaction-trends-chart";

export function DashboardContent() {
  const { range, setRange } = useFilters((s) => ({
    range: s.range,
    setRange: s.setRange,
  }));

  useEffect(() => {
    if (!range) {
      const today = new Date();
      const m = today.getMonth() + 1;
      const y = today.getFullYear();
      setRange({
        from: new Date(m === 1 ? y - 1 : y, m === 1 ? 11 : m - 2, 25),
        to: new Date(y, m - 1, 25),
      });
    }
  }, [range, setRange]);

  return (
    <div className="space-y-8 pb-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Dashboard
        </h1>
        <DateRangePicker date={range} onDateChange={setRange} />
      </div>

      {/* Net Worth */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider border-l-2 border-primary pl-3">
          Net Worth
        </h2>
        <FinancialHealthSection range={range} />
      </section>

      {/* Overview */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider border-l-2 border-primary pl-3">
          Overview
        </h2>
        <StatCardsSection range={range} />
      </section>

      {/* Financial Trends */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider border-l-2 border-primary pl-3">
          Financial Trends
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          <div className="md:col-span-12 lg:col-span-8 h-full">
            <TransactionTrendsChart range={range} />
          </div>
          <div className="md:col-span-12 lg:col-span-4 h-full">
            <InsightsPanel range={range} />
          </div>
        </div>
      </section>

      {/* Breakdown */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider border-l-2 border-primary pl-3">
          Breakdown
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          <div className="md:col-span-6 lg:col-span-4">
            <AccountOverviewChart />
          </div>
          <div className="md:col-span-6 lg:col-span-4">
            <ExpenseBreakdownChart range={range} />
          </div>
          <div className="md:col-span-12 lg:col-span-4">
            <BudgetVsActualChart range={range} />
          </div>
        </div>
      </section>

      {/* Budget Analysis */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider border-l-2 border-primary pl-3">
          Budget Analysis
        </h2>
        <MonthlyComparisonChart range={range} />
      </section>
    </div>
  );
}
