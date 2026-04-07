import { sql } from "drizzle-orm";
import { check, decimal, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { financeSchema } from "../schema";
import { budgets } from "./budget.schema";

export const budgetItems = financeSchema.table(
  "budget_items",
  {
    id: uuid("id").primaryKey(),
    budgetId: uuid("budget_id")
      .notNull()
      .references(() => budgets.id, { onDelete: "cascade" }),
    category: varchar("category", { length: 255 }).notNull(),
    allocation: decimal("allocation", { precision: 15, scale: 2 }).notNull(),
    spent: decimal("spent", { precision: 15, scale: 2 }).default("0"),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date()),
    version: decimal("version", { precision: 20, scale: 0 })
      .notNull()
      .default("1"),
  },
  (_table) => [
    // Normalized SQL matching PostgreSQL's stored form (PG adds ::numeric cast for numeric columns)
    check(
      "chk_budget_items_allocation_non_negative",
      sql`allocation >= (0)::numeric`,
    ),
  ],
);
