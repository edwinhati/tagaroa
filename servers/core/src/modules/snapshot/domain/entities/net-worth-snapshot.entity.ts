export interface AssetsBreakdown {
  liquidity: number;
  investments: number;
  fixedAssets: number;
}

export interface LiabilitiesBreakdown {
  revolving: number;
  termLoans: number;
}

export interface FxRatesUsed {
  [currency: string]: number;
}

export class NetWorthSnapshot {
  constructor(
    public readonly id: string,
    public readonly userId: string,
    public readonly snapshotDate: Date,
    public readonly totalAssets: number,
    public readonly totalLiabilities: number,
    public readonly netWorth: number,
    public readonly baseCurrency: string,
    public readonly assetsBreakdown: AssetsBreakdown,
    public readonly liabilitiesBreakdown: LiabilitiesBreakdown,
    public readonly fxRatesUsed: FxRatesUsed,
    public readonly fxRateDate: Date,
    public readonly fxRateSource: string | null,
    public readonly createdAt: Date,
    public readonly version: number,
  ) {}

  toEvent(): {
    type: "net_worth";
    userId: string;
    snapshotDate: Date;
    baseCurrency: string;
    totals: { assets: number; liabilities: number; netWorth: number };
    breakdown: AssetsBreakdown & LiabilitiesBreakdown;
    metadata: {
      fxRates: FxRatesUsed;
      fxRateDate: Date;
      fxRateSource: string | null;
    };
  } {
    return {
      type: "net_worth",
      userId: this.userId,
      snapshotDate: this.snapshotDate,
      baseCurrency: this.baseCurrency,
      totals: {
        assets: this.totalAssets,
        liabilities: this.totalLiabilities,
        netWorth: this.netWorth,
      },
      breakdown: {
        ...this.assetsBreakdown,
        ...this.liabilitiesBreakdown,
      },
      metadata: {
        fxRates: this.fxRatesUsed,
        fxRateDate: this.fxRateDate,
        fxRateSource: this.fxRateSource,
      },
    };
  }
}
