export const AssetType = {
  CASH: "CASH",
  SAVINGS: "SAVINGS",
  INVESTMENT: "INVESTMENT",
  REAL_ESTATE: "REAL_ESTATE",
  VEHICLE: "VEHICLE",
  CRYPTO: "CRYPTO",
  STOCK: "STOCK",
  BOND: "BOND",
  MUTUAL_FUND: "MUTUAL_FUND",
  OTHER: "OTHER",
} as const;

export type AssetType = (typeof AssetType)[keyof typeof AssetType];

const validTypes = new Set<string>(Object.values(AssetType));

export function isValidAssetType(value: string): value is AssetType {
  return validTypes.has(value);
}
