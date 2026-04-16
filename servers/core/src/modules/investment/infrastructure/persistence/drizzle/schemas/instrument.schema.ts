import { index, jsonb, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { investmentSchema } from "../schema";

export const instruments = investmentSchema.table(
  "instruments",
  {
    id: uuid("id").primaryKey(),
    ticker: varchar("ticker", { length: 20 }).notNull().unique(),
    name: varchar("name", { length: 255 }).notNull(),
    assetClass: varchar("asset_class", { length: 50 }).notNull(),
    exchange: varchar("exchange", { length: 100 }),
    currency: varchar("currency", { length: 10 }).notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("idx_instruments_ticker").on(table.ticker),
    index("idx_instruments_asset_class").on(table.assetClass),
  ],
);
