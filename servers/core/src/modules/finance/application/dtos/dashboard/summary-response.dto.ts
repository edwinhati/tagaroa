export class MoneyAmountDto {
  amount: number;
  currency: string;
}

export class PeriodComparisonDto {
  current: number;
  previous: number;
  change: number;
}

export class SummaryResponseDto {
  income: MoneyAmountDto;
  expenses: MoneyAmountDto;
  savings: MoneyAmountDto;
  budget_utilization: number;
  income_comparison: PeriodComparisonDto;
  expense_comparison: PeriodComparisonDto;
  savings_comparison: PeriodComparisonDto;
  previous_period_start: string;
  previous_period_end: string;
}
