import { index, pgSchema, text, timestamp } from "drizzle-orm/pg-core";

import { user } from "../../../../auth/infrastructure/persistence/drizzle/schema";

/**
 * The trail's own handle on the `directory` Postgres schema, where the table
 * was created and stays. The Nest module that owns the writes moved; the table
 * did not, so no migration follows from the move.
 */
const directorySchema = pgSchema("directory");

/**
 * Durable evidence for identity changes made through Better Auth and the
 * Tagaroa directory endpoints. Actor and target survive only while their user
 * rows do; the event itself remains after deletion.
 *
 * Two modules write here — `auth`, for what Better Auth's admin routes did, and
 * `directory`, for the grants and reviews it owns — which is why the table has a
 * module of its own rather than living inside either writer. See `AuditTrail`.
 */
export const authAuditEvent = directorySchema.table(
  "auth_audit_event",
  {
    id: text("id").primaryKey(),
    type: text("type").notNull(),
    actorId: text("actor_id").references(() => user.id, {
      onDelete: "set null",
    }),
    targetUserId: text("target_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    detail: text("detail"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("authAuditEvent_createdAt_idx").on(table.createdAt),
    index("authAuditEvent_actorId_idx").on(table.actorId),
    index("authAuditEvent_targetUserId_idx").on(table.targetUserId),
  ],
);
