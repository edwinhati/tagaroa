export const AccountType = {
  BANK: "BANK",
  E_WALLET: "E-WALLET",
  CASH: "CASH",
  CREDIT_CARD: "CREDIT-CARD",
  PAY_LATER: "PAY-LATER",
} as const;

export type AccountType = (typeof AccountType)[keyof typeof AccountType];
