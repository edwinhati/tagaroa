export class InsightItemDto {
  category!: string;
  amount!: number;
  percentage!: number;
}

export class InsightsResponseDto {
  savings_rate!: number;
  savings_rate_trend!: "up" | "down" | "stable";
  top_income_sources!: InsightItemDto[];
  top_expenses!: InsightItemDto[];
  recommendations!: string[];
}
