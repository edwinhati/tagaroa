import { z } from "zod";

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
export const AssetTypeSchema = z.enum([
  "CASH",
  "SAVINGS",
  "INVESTMENT",
  "REAL_ESTATE",
  "VEHICLE",
  "CRYPTO",
  "STOCK",
  "BOND",
  "MUTUAL_FUND",
  "OTHER",
]);
