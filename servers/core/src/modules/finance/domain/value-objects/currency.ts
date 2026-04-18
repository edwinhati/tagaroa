import { z } from "zod";

export const Currency = {
  USD: "USD",
  IDR: "IDR",
  EUR: "EUR",
  GBP: "GBP",
  JPY: "JPY",
  SGD: "SGD",
} as const;

export type Currency = (typeof Currency)[keyof typeof Currency];
export const CurrencySchema = z.enum([
  "USD",
  "IDR",
  "EUR",
  "GBP",
  "JPY",
  "SGD",
]);
