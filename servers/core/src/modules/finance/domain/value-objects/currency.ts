export const Currency = {
  USD: "USD",
  IDR: "IDR",
  EUR: "EUR",
  GBP: "GBP",
  JPY: "JPY",
  SGD: "SGD",
} as const;

export type Currency = (typeof Currency)[keyof typeof Currency];
