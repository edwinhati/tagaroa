import {
  decimal,
  index,
  primaryKey,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { investmentSchema } from "../schema";
import { instruments } from "./instrument.schema";

export const ohlcv = investmentSchema.table(
  "ohlcv",
  {
    instrumentId: uuid("instrument_id")
      .notNull()
      .references(() => instruments.id, { onDelete: "cascade" }),
    timestamp: timestamp("timestamp", { withTimezone: true }).notNull(),
    timeframe: varchar("timeframe", { length: 10 }).notNull(),
    open: decimal("open", { precision: 20, scale: 8 }).notNull(),
    high: decimal("high", { precision: 20, scale: 8 }).notNull(),
    low: decimal("low", { precision: 20, scale: 8 }).notNull(),
    close: decimal("close", { precision: 20, scale: 8 }).notNull(),
    volume: decimal("volume", { precision: 24, scale: 8 }).notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.instrumentId, table.timestamp, table.timeframe],
    }),
    index("idx_ohlcv_instrument_timeframe_ts").on(
      table.instrumentId,
      table.timeframe,
      table.timestamp,
    ),
  ],
);
