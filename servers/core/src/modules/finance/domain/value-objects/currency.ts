export const Currency = {
  USD: "USD",
  IDR: "IDR",
  EUR: "EUR",
  GBP: "GBP",
  JPY: "JPY",
  SGD: "SGD",
} as const;

export type Currency = (typeof Currency)[keyof typeof Currency];

const validCurrencies = new Set<string>(Object.values(Currency));

export function isValidCurrency(value: string): value is Currency {
  return validCurrencies.has(value);
}
