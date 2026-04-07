import { decimal, index, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { investmentSchema } from "../schema";
import { instruments } from "./instrument.schema";
import { portfolios } from "./portfolio.schema";
import { positions } from "./position.schema";

export const trades = investmentSchema.table(
  "trades",
  {
    id: uuid("id").primaryKey(),
    portfolioId: uuid("portfolio_id")
      .notNull()
      .references(() => portfolios.id, { onDelete: "cascade" }),
    positionId: uuid("position_id").references(() => positions.id, {
      onDelete: "set null",
    }),
    instrumentId: uuid("instrument_id")
      .notNull()
      .references(() => instruments.id, { onDelete: "restrict" }),
    side: varchar("side", { length: 10 }).notNull(), // BUY | SELL
    quantity: decimal("quantity", { precision: 24, scale: 8 }).notNull(),
    price: decimal("price", { precision: 20, scale: 8 }).notNull(),
    fees: decimal("fees", { precision: 20, scale: 8 }).notNull().default("0"),
    realizedPnl: decimal("realized_pnl", { precision: 20, scale: 8 }),
    timestamp: timestamp("timestamp", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date()),
    version: decimal("version", { precision: 20, scale: 0 })
      .notNull()
      .default("1"),
  },
  (table) => [
    index("idx_trades_portfolio_id").on(table.portfolioId),
    index("idx_trades_position_id").on(table.positionId),
    index("idx_trades_instrument_id").on(table.instrumentId),
    index("idx_trades_portfolio_ts").on(table.portfolioId, table.timestamp),
  ],
);
