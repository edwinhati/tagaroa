export class ExpenseBreakdownItemDto {
  category!: string;
  amount!: number;
  percentage!: number;
}

export class ExpenseBreakdownResponseDto {
  total_expenses!: number;
  items!: ExpenseBreakdownItemDto[];
}
