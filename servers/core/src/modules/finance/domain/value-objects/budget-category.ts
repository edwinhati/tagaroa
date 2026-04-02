type BudgetCategory = {
  name: string;
  type: string;
};

const BudgetCategoryType = {
  MONTHLY_EXPENSE: "MONTHLY EXPENSE",
  DAILY_EXPENSE: "DAILY EXPENSE",
  WEEKLY_EXPENSE: "WEEKLY EXPENSE",
  LIABILITY: "LIABILITY",
  OTHER: "OTHER",
} as const;

export function getDefaultCategories(): BudgetCategory[] {
  return [
    { name: "Housing", type: BudgetCategoryType.MONTHLY_EXPENSE },
    { name: "Food", type: BudgetCategoryType.DAILY_EXPENSE },
    { name: "Utilities", type: BudgetCategoryType.MONTHLY_EXPENSE },
    { name: "Transportation", type: BudgetCategoryType.DAILY_EXPENSE },
    { name: "Hygiene", type: BudgetCategoryType.MONTHLY_EXPENSE },
    { name: "Laundry", type: BudgetCategoryType.WEEKLY_EXPENSE },
    { name: "Insurance", type: BudgetCategoryType.MONTHLY_EXPENSE },
    { name: "Installment", type: BudgetCategoryType.LIABILITY },
    { name: "Tithes", type: BudgetCategoryType.OTHER },
  ];
}
