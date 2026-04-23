export interface SnapshotCreatedEvent {
  type: "net_worth" | "portfolio";
  userId: string;
  sourceId?: string;
  snapshotDate: Date;
  baseCurrency: string;
  totals?: {
    assets: number;
    liabilities: number;
    netWorth: number;
  };
  nav?: number;
  cash?: number;
  breakdown?: {
    liquidity: number;
    investments: number;
    fixedAssets: number;
    revolving: number;
    termLoans: number;
  };
  positions?: Array<{
    instrumentId: string;
    quantity: number;
    averageCost: number;
    side: "LONG" | "SHORT";
  }>;
  metadata?: {
    fxRates?: Record<string, number>;
    fxRateDate?: Date;
    fxRateSource?: string;
    schedulerRunId?: string;
  };
}
