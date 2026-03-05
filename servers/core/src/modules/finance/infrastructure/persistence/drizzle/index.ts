import { relations } from "drizzle-orm";
import { accounts } from "./schemas/account.schema";
import { budgets } from "./schemas/budget.schema";
import { budgetItems } from "./schemas/budget-item.schema";
import { transactions } from "./schemas/transaction.schema";

export { financeSchema } from "./schema";
export { accounts } from "./schemas/account.schema";
export { assets } from "./schemas/asset.schema";
export { budgets } from "./schemas/budget.schema";
export { budgetItems } from "./schemas/budget-item.schema";
export { liabilities } from "./schemas/liability.schema";
export { netWorthSnapshots } from "./schemas/net-worth-snapshot.schema";
export { transactions } from "./schemas/transaction.schema";

export const accountsRelations = relations(accounts, ({ many }) => ({
  transactions: many(transactions),
}));

export const budgetsRelations = relations(budgets, ({ many }) => ({
  budgetItems: many(budgetItems),
}));

export const budgetItemsRelations = relations(budgetItems, ({ one, many }) => ({
  budget: one(budgets, {
    fields: [budgetItems.budgetId],
    references: [budgets.id],
  }),
  transactions: many(transactions),
}));

export const transactionsRelations = relations(transactions, ({ one }) => ({
  account: one(accounts, {
    fields: [transactions.accountId],
    references: [accounts.id],
  }),
  budgetItem: one(budgetItems, {
    fields: [transactions.budgetItemId],
    references: [budgetItems.id],
  }),
}));
