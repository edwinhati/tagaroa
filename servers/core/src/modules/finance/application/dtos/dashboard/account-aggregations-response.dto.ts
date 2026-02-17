export class AccountAggregationDto {
  type: string;
  count: number;
  balance: number;
}

export class AccountAggregationsResponseDto {
  by_type: AccountAggregationDto[];
  by_currency: AccountAggregationDto[];
}
