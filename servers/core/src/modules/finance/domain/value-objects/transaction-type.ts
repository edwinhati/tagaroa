import { z } from "zod";

export const TransactionType = {
  INCOME: "INCOME",
  EXPENSE: "EXPENSE",
} as const;

export type TransactionType =
  (typeof TransactionType)[keyof typeof TransactionType];
export const TransactionTypeSchema = z.enum(["INCOME", "EXPENSE"]);
