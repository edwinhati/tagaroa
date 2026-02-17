import {
  decimal,
  integer,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { financeSchema } from "../schema";

export const accounts = financeSchema.table("accounts", {
  id: uuid("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  type: varchar("type", { length: 50 }).notNull(),
  balance: decimal("balance", { precision: 15, scale: 2 }).default("0"),
  userId: uuid("user_id").notNull(),
  currency: varchar("currency", { length: 3 }).notNull(),
  notes: text("notes"),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date()),
  version: integer("version").default(1),
});
