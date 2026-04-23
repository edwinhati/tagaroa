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
    public readonly archivedAt: Date | null = null,
    public readonly s3Key: string | null = null,
  ) {}

  markAsArchived(s3Key: string): NetWorthSnapshot {
    return new NetWorthSnapshot(
      this.id,
      this.userId,
      this.snapshotDate,
      this.totalAssets,
      this.totalLiabilities,
      this.netWorth,
      this.baseCurrency,
      this.assetsBreakdown,
      this.liabilitiesBreakdown,
      this.fxRatesUsed,
      this.fxRateDate,
      this.fxRateSource,
      this.createdAt,
      this.version,
      new Date(),
      s3Key,
    );
  }

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
    archivedAt: Date | null;
    s3Key: string | null;
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
      archivedAt: this.archivedAt,
      s3Key: this.s3Key,
    };
  }
}
