import {
  index,
  pgSchema,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import {
  organization,
  user,
} from "../../../../auth/infrastructure/persistence/drizzle/schema";

/**
 * Ours, not Better Auth's. `bun run auth:schema` regenerates the whole `auth`
 * schema file from the plugin definitions, and Better Auth exposes
 * `additionalFields` for organization, member, invitation, team and
 * organizationRole but not for teamMember — so a `role` column on
 * `auth.team_member` would be both unwritable through `addTeamMember` and
 * deleted by the next generation. This schema is hand-written and stays.
 */
export const directorySchema = pgSchema("directory");

/**
 * The operator's latest confirmation that a privileged person's access is
 * still intentional. A confirmation becomes stale when the person's auth row
 * changes, so role edits automatically return the person to the review queue.
 */
export const privilegedAccessReview = directorySchema.table(
  "privileged_access_review",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    reviewedAt: timestamp("reviewed_at").notNull().defaultNow(),
    reviewedBy: text("reviewed_by").references(() => user.id, {
      onDelete: "set null",
    }),
  },
  (table) => [
    uniqueIndex("privilegedAccessReview_userId_idx").on(table.userId),
    index("privilegedAccessReview_reviewedAt_idx").on(table.reviewedAt),
  ],
);

/** A title and reporting line. It is directory data, never an access grant. */
export const personPosition = directorySchema.table(
  "person_position",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    organizationId: text("organization_id").references(() => organization.id, {
      onDelete: "cascade",
    }),
    scopeKey: text("scope_key").notNull(),
    title: text("title").notNull(),
    managerUserId: text("manager_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    createdBy: text("created_by").references(() => user.id, {
      onDelete: "set null",
    }),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
    updatedBy: text("updated_by").references(() => user.id, {
      onDelete: "set null",
    }),
  },
  (table) => [
    uniqueIndex("personPosition_user_scope_uidx").on(
      table.userId,
      table.scopeKey,
    ),
    index("personPosition_organizationId_idx").on(table.organizationId),
    index("personPosition_managerUserId_idx").on(table.managerUserId),
  ],
);
