import { pgSchema, text, timestamp, index } from "drizzle-orm/pg-core";

import { user } from "./infrastructure/persistence/drizzle/schema";

// Hand-owned operations stay outside Better Auth's generated schema.
export const identityOperationsSchema = pgSchema("identity_operations");
export const factorRecovery = identityOperationsSchema.table(
  "factor_recovery",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    requestedBy: text("requested_by").references(() => user.id, {
      onDelete: "set null",
    }),
    requestedAt: timestamp("requested_at").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    reason: text("reason").notNull(),
    evidence: text("evidence").notNull(),
    snapshot: text("snapshot").notNull(),
    completedAt: timestamp("completed_at"),
    approvedBy: text("approved_by").references(() => user.id, {
      onDelete: "set null",
    }),
    approvalEvidence: text("approval_evidence"),
  },
  (table) => [index("factorRecovery_userId_idx").on(table.userId)],
);
