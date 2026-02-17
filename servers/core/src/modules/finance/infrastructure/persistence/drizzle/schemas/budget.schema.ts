import { sql } from "drizzle-orm";
import {
  check,
  decimal,
  integer,
  timestamp,
  unique,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { financeSchema } from "../schema";

export const budgets = financeSchema.table(
  "budgets",
  {
    id: uuid("id").primaryKey(),
    month: integer("month").notNull(),
    year: integer("year").notNull(),
    amount: decimal("amount", { precision: 15, scale: 2 }).default("0"),
    userId: uuid("user_id").notNull(),
    currency: varchar("currency", { length: 3 }).notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date()),
    version: integer("version").default(1),
  },
  (table) => [
    unique("budgets_user_month_year_unique").on(
      table.userId,
      table.year,
      table.month,
    ),
    check("chk_budgets_month", sql`${table.month} BETWEEN 1 AND 12`),
    check("chk_budgets_year", sql`${table.year} BETWEEN 2000 AND 2100`),
    check("chk_budgets_amount_non_negative", sql`${table.amount} >= 0`),
  ],
);
