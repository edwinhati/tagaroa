import {
  decimal,
  index,
  integer,
  jsonb,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { financeSchema } from "../schema";
import { transactions } from "./transaction.schema";

export const liabilities = financeSchema.table(
  "liabilities",
  {
    id: uuid("id").primaryKey(),
    userId: uuid("user_id").notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    type: varchar("type", { length: 50 }).notNull(),
    amount: decimal("amount", { precision: 15, scale: 2 })
      .notNull()
      .default("0"),
    currency: varchar("currency", { length: 3 }).notNull(),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    notes: text("notes"),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date()),
    version: integer("version").default(1),
    // Installment-related fields
    transactionId: uuid("transaction_id").references(() => transactions.id, {
      onDelete: "set null",
    }),
    installmentNumber: integer("installment_number"),
    originalAmount: decimal("original_amount", { precision: 15, scale: 2 }),
    totalInterest: decimal("total_interest", { precision: 15, scale: 2 }),
    totalAmount: decimal("total_amount", { precision: 15, scale: 2 }),
    remainingMonths: integer("remaining_months"),
    installmentMetadata: jsonb("installment_metadata"),
    dueAt: timestamp("due_at", { withTimezone: true }),
  },
  (table) => [
    index("idx_liabilities_user_id").on(table.userId),
    index("idx_liabilities_transaction_id").on(table.transactionId),
  ],
);
