export class BudgetPerformanceItemDto {
  category: string;
  allocated: number;
  spent: number;
  remaining: number;
  percentage: number;
  is_over_budget: boolean;
}

export class BudgetPerformanceResponseDto {
  month: number;
  year: number;
  items: BudgetPerformanceItemDto[];
  total_allocated: number;
  total_spent: number;
  total_remaining: number;
  overall_percentage: number;
}
