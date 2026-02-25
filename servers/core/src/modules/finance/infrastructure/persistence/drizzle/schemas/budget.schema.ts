import { sql } from "drizzle-orm";
import {
  check,
  decimal,
  index,
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
    // Column order matches PostgreSQL's stored index order (drizzle-kit PG17+ reads btree index columns directly)
    unique("budgets_user_month_year_unique").on(
      table.year,
      table.userId,
      table.month,
    ),
    // Normalized SQL matching PostgreSQL's stored form (PG normalizes BETWEEN → >= AND <=, adds ::numeric casts)
    check("chk_budgets_month", sql`(month >= 1) AND (month <= 12)`),
    check("chk_budgets_year", sql`(year >= 2000) AND (year <= 2100)`),
    check("chk_budgets_amount_non_negative", sql`amount >= (0)::numeric`),
    index("idx_budgets_user_id").on(table.userId),
  ],
);
