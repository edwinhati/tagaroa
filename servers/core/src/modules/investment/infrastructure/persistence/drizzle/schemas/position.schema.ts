import { decimal, index, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { investmentSchema } from "../schema";
import { instruments } from "./instrument.schema";
import { portfolios } from "./portfolio.schema";

export const positions = investmentSchema.table(
  "positions",
  {
    id: uuid("id").primaryKey(),
    portfolioId: uuid("portfolio_id")
      .notNull()
      .references(() => portfolios.id, { onDelete: "cascade" }),
    instrumentId: uuid("instrument_id")
      .notNull()
      .references(() => instruments.id, { onDelete: "restrict" }),
    quantity: decimal("quantity", { precision: 24, scale: 8 }).notNull(),
    averageCost: decimal("average_cost", { precision: 20, scale: 8 }).notNull(),
    side: varchar("side", { length: 10 }).notNull(),
    openedAt: timestamp("opened_at", { withTimezone: true }).notNull(),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date()),
    version: decimal("version", { precision: 20, scale: 0 })
      .notNull()
      .default("1"),
  },
  (table) => [
    index("idx_positions_portfolio_id").on(table.portfolioId),
    index("idx_positions_instrument_id").on(table.instrumentId),
    index("idx_positions_portfolio_closed").on(
      table.portfolioId,
      table.closedAt,
    ),
  ],
);
