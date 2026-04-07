import { decimal, index, jsonb, timestamp, uuid } from "drizzle-orm/pg-core";
import { investmentSchema } from "../schema";
import { portfolios } from "./portfolio.schema";

export const portfolioSnapshots = investmentSchema.table(
  "portfolio_snapshots",
  {
    id: uuid("id").primaryKey(),
    portfolioId: uuid("portfolio_id")
      .notNull()
      .references(() => portfolios.id, { onDelete: "cascade" }),
    timestamp: timestamp("timestamp", { withTimezone: true }).notNull(),
    nav: decimal("nav", { precision: 20, scale: 8 }).notNull(),
    cash: decimal("cash", { precision: 20, scale: 8 }).notNull(),
    positionsSnapshot: jsonb("positions_snapshot"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    version: decimal("version", { precision: 20, scale: 0 })
      .notNull()
      .default("1"),
  },
  (table) => [
    index("idx_portfolio_snapshots_portfolio_id").on(table.portfolioId),
    index("idx_portfolio_snapshots_portfolio_ts").on(
      table.portfolioId,
      table.timestamp,
    ),
  ],
);
