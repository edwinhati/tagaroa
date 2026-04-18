import { z } from "zod";

export const AccountType = {
  BANK: "BANK",
  E_WALLET: "E-WALLET",
  CASH: "CASH",
  CREDIT_CARD: "CREDIT-CARD",
  PAY_LATER: "PAY-LATER",
} as const;

export type AccountType = (typeof AccountType)[keyof typeof AccountType];
export const AccountTypeSchema = z.enum([
  "BANK",
  "E-WALLET",
  "CASH",
  "CREDIT-CARD",
  "PAY-LATER",
]);
