import {
  decimal,
  integer,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { financeSchema } from "../schema";

export const liabilities = financeSchema.table("liabilities", {
  id: uuid("id").primaryKey(),
  userId: uuid("user_id").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  type: varchar("type", { length: 50 }).notNull(),
  amount: decimal("amount", { precision: 15, scale: 2 }).notNull().default("0"),
  currency: varchar("currency", { length: 3 }).notNull(),
  paidAt: timestamp("paid_at", { withTimezone: true }),
  notes: text("notes"),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date()),
  version: integer("version").default(1),
});
