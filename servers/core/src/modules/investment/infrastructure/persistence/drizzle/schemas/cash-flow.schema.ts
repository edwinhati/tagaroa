import {
  decimal,
  index,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { investmentSchema } from "../schema";
import { portfolios } from "./portfolio.schema";

export const cashFlows = investmentSchema.table(
  "cash_flows",
  {
    id: uuid("id").primaryKey(),
    portfolioId: uuid("portfolio_id")
      .notNull()
      .references(() => portfolios.id, { onDelete: "cascade" }),
    type: varchar("type", { length: 20 }).notNull(), // DEPOSIT | WITHDRAWAL | DIVIDEND | FEE
    amount: decimal("amount", { precision: 20, scale: 8 }).notNull(),
    description: text("description"),
    timestamp: timestamp("timestamp", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index("idx_cash_flows_portfolio_id").on(table.portfolioId),
    index("idx_cash_flows_portfolio_ts").on(table.portfolioId, table.timestamp),
  ],
);
