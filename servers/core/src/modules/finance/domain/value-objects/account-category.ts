export const AccountCategory = {
  ASSET: "ASSET",
  LIABILITY: "LIABILITY",
  OTHER: "OTHER",
} as const;

export type AccountCategory =
  (typeof AccountCategory)[keyof typeof AccountCategory];

const validCategories = new Set<string>(Object.values(AccountCategory));

export function isValidAccountCategory(
  value: string,
): value is AccountCategory {
  return validCategories.has(value);
}

// Map account types to their corresponding categories
export function getAccountCategoryFromType(type: string): AccountCategory {
  const liabilityTypes = new Set(["CREDIT-CARD", "PAY-LATER"]);
  if (liabilityTypes.has(type)) {
    return AccountCategory.LIABILITY;
  }
  return AccountCategory.ASSET;
}
