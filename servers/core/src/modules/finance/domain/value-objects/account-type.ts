export const AccountType = {
  BANK: "BANK",
  E_WALLET: "E-WALLET",
  CASH: "CASH",
  CREDIT_CARD: "CREDIT-CARD",
  PAY_LATER: "PAY-LATER",
} as const;

export type AccountType = (typeof AccountType)[keyof typeof AccountType];

const validTypes = new Set<string>(Object.values(AccountType));

export function isValidAccountType(value: string): value is AccountType {
  return validTypes.has(value);
}
