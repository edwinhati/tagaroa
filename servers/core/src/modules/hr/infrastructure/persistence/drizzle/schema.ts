import { pgSchema, text, timestamp } from "drizzle-orm/pg-core";

import { user } from "../../../../auth/infrastructure/persistence/drizzle/schema";

export const hrSchema = pgSchema("hr");

/**
 * One row per HR record that has an account. Deleting the account deletes the
 * link, so a record whose account was removed is issued a fresh one only if HR
 * still shows it active and the address is free.
 */
export const employeeAccount = hrSchema.table("employee_account", {
  employee: text("employee").primaryKey(),
  userId: text("user_id")
    .notNull()
    .unique()
    .references(() => user.id, { onDelete: "cascade" }),
  linkedAt: timestamp("linked_at").notNull().defaultNow(),
});
