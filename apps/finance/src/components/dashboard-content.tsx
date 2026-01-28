"use client";

import { useBudgetPeriod } from "@repo/common/hooks/use-budget-period";
import { useState } from "react";
import type { DateRange } from "react-day-picker";
import { AccountOverviewChart } from "@/components/account-overview-chart";
import { BudgetVsActualChart } from "@/components/budget-vs-actual-chart";
import { DateRangePicker } from "@/components/date-range-picker";
import { ExpenseBreakdownChart } from "@/components/expense-breakdown-chart";
import { MonthlyComparisonChart } from "@/components/monthly-comparison-chart";
import { StatCardsSection } from "@/components/stat-cards-section";
import { TransactionTrendsChart } from "@/components/transaction-trends-chart";

export function DashboardContent() {
  const { month, year } = useBudgetPeriod((s) => ({
    month: s.month,
    year: s.year,
  }));

  const [range, setRange] = useState<DateRange | undefined>({
    from: new Date(
      month === 1 ? year - 1 : year,
      month === 1 ? 11 : month - 2,
      25,
    ),
    to: new Date(year, month - 1, 25),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <DateRangePicker date={range} onDateChange={setRange} />
      </div>

      <StatCardsSection range={range} />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
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

      <div className="grid gap-4 md:grid-cols-2">
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
