export class TransactionTrendItemDto {
  period!: string;
  income!: number;
  expenses!: number;
  net_flow!: number;
}

export class TransactionTrendsResponseDto {
  granularity!: string;
  trends!: TransactionTrendItemDto[];
}
