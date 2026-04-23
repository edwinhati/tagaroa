import { decimal, index, jsonb, timestamp, uuid } from "drizzle-orm/pg-core";
import { snapshotSchema } from "../schema";

export const portfolio = snapshotSchema.table(
  "portfolio",
  {
    id: uuid("id").primaryKey(),
    portfolioId: uuid("portfolio_id").notNull(),
    userId: uuid("user_id").notNull(),
    timestamp: timestamp("timestamp", { withTimezone: true }).notNull(),
    nav: decimal("nav", { precision: 20, scale: 8 }).notNull(),
    cash: decimal("cash", { precision: 20, scale: 8 }).notNull(),
    positionsSnapshot:
      jsonb("positions_snapshot").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    version: decimal("version", { precision: 20, scale: 0 })
      .notNull()
      .default("1"),
  },
  (table) => [
    index("idx_portfolio_portfolio_id").on(table.portfolioId),
    index("idx_portfolio_portfolio_ts").on(table.portfolioId, table.timestamp),
    index("idx_portfolio_user_id").on(table.userId),
  ],
);
