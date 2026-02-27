export const AssetClass = {
  STOCK: "STOCK",
  CRYPTO: "CRYPTO",
  FOREX: "FOREX",
  ETF: "ETF",
  COMMODITY: "COMMODITY",
} as const;

export type AssetClass = (typeof AssetClass)[keyof typeof AssetClass];

const validClasses = new Set<string>(Object.values(AssetClass));

export function isValidAssetClass(value: string): value is AssetClass {
  return validClasses.has(value);
}
