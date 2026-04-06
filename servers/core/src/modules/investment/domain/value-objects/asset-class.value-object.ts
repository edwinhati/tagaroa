export const AssetClass = {
  STOCK: "STOCK",
  CRYPTO: "CRYPTO",
  FOREX: "FOREX",
  ETF: "ETF",
  COMMODITY: "COMMODITY",
} as const;

export type AssetClass = (typeof AssetClass)[keyof typeof AssetClass];
