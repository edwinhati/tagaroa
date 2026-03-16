import {
  date,
  decimal,
  index,
  integer,
  jsonb,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { financeSchema } from "../schema";
import { accounts } from "./account.schema";
import { budgetItems } from "./budget-item.schema";

export const transactions = financeSchema.table(
  "transactions",
  {
    id: uuid("id").primaryKey(),
    amount: decimal("amount", { precision: 15, scale: 2 }).default("0"),
    date: date("date").notNull(),
    notes: text("notes"),
    currency: varchar("currency", { length: 3 }).notNull(),
    type: varchar("type", { length: 50 }).notNull(),
    files: text("files").array(),
    userId: uuid("user_id").notNull(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    budgetItemId: uuid("budget_item_id").references(() => budgetItems.id, {
      onDelete: "set null",
    }),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date()),
    version: integer("version").default(1),
    // Installment metadata for credit card/pay-later transactions
    installment: jsonb("installment"),
  },
  (table) => [
    index("idx_transactions_user_id").on(table.userId),
    index("idx_transactions_account_id").on(table.accountId),
    index("idx_transactions_budget_item_id").on(table.budgetItemId),
    index("idx_transactions_date").on(table.date),
    index("idx_transactions_user_date").on(table.userId, table.date),
  ],
);
