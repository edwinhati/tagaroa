export type MoneyAmount = {
  amount: number;
  currency: string;
};

export type PeriodComparison = {
  current: number;
  previous: number;
  change: number;
};

export type SummaryResult = {
  income: MoneyAmount;
  expenses: MoneyAmount;
  savings: MoneyAmount;
  budget_utilization: number;
  income_comparison: PeriodComparison;
  expense_comparison: PeriodComparison;
  savings_comparison: PeriodComparison;
  previous_period_start: string;
  previous_period_end: string;
};

export type AccountAggregation = {
  type: string;
  count: number;
  balance: number;
};

export type AccountAggregationsResult = {
  by_type: AccountAggregation[];
  by_currency: AccountAggregation[];
};

export type BudgetPerformanceItem = {
  category: string;
  allocated: number;
  spent: number;
  remaining: number;
  percentage: number;
  is_over_budget: boolean;
};

export type BudgetPerformanceResult = {
  month: number;
  year: number;
  items: BudgetPerformanceItem[];
  total_allocated: number;
  total_spent: number;
  total_remaining: number;
  overall_percentage: number;
};

export type TransactionTrendItem = {
  period: string;
  income: number;
  expenses: number;
  net_flow: number;
};

export type TransactionTrendsResult = {
  granularity: string;
  trends: TransactionTrendItem[];
};

export type ExpenseBreakdownItem = {
  category: string;
  amount: number;
  percentage: number;
};

export type ExpenseBreakdownResult = {
  total_expenses: number;
  items: ExpenseBreakdownItem[];
};
