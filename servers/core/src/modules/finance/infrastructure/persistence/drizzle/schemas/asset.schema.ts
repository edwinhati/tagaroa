import {
  decimal,
  index,
  integer,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { financeSchema } from "../schema";

export const assets = financeSchema.table(
  "assets",
  {
    id: uuid("id").primaryKey(),
    userId: uuid("user_id").notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    type: varchar("type", { length: 50 }).notNull(),
    value: decimal("value", { precision: 15, scale: 2 }).notNull().default("0"),
    shares: decimal("shares", { precision: 15, scale: 6 }),
    ticker: varchar("ticker", { length: 20 }),
    currency: varchar("currency", { length: 3 }).notNull(),
    notes: text("notes"),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date()),
    version: integer("version").default(1),
  },
  (table) => [index("idx_assets_user_id").on(table.userId)],
);
