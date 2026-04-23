export class NetWorthSnapshotDto {
  date!: string;
  total_assets!: number;
  total_liabilities!: number;
  net_worth!: number;
}

export class NetWorthResponseDto {
  current_net_worth!: number;
  total_assets!: number;
  total_liabilities!: number;
  currency!: string;
  snapshots!: NetWorthSnapshotDto[];
}
