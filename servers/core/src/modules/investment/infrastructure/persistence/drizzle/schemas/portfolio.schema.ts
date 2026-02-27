import {
  decimal,
  index,
  integer,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { investmentSchema } from "../schema";

export const portfolios = investmentSchema.table(
  "portfolios",
  {
    id: uuid("id").primaryKey(),
    userId: uuid("user_id").notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    mode: varchar("mode", { length: 20 }).notNull(),
    initialCapital: decimal("initial_capital", {
      precision: 20,
      scale: 8,
    }).notNull(),
    currency: varchar("currency", { length: 10 }).notNull(),
    status: varchar("status", { length: 20 }).notNull().default("active"),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date()),
    version: integer("version").default(1),
  },
  (table) => [
    index("idx_portfolios_user_id").on(table.userId),
    index("idx_portfolios_user_status").on(table.userId, table.status),
  ],
);
