import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  pgSchema,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import {
  organization,
  session,
  team,
  user,
} from "../../../../auth/infrastructure/persistence/drizzle/schema";

/** Business access is ours. Better Auth continues to own identity and membership. */
export const accessControlSchema = pgSchema("access_control");

export const accessRole = accessControlSchema.table(
  "access_role",
  {
    id: text("id").primaryKey(),
    key: text("key").notNull(),
    name: text("name").notNull(),
    description: text("description").notNull(),
    system: boolean("system").notNull().default(false),
    archivedAt: timestamp("archived_at"),
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
    uniqueIndex("accessRole_key_uidx").on(table.key),
    uniqueIndex("accessRole_name_uidx").on(sql`lower(${table.name})`),
    index("accessRole_archivedAt_idx").on(table.archivedAt),
  ],
);

export const accessRolePermission = accessControlSchema.table(
  "access_role_permission",
  {
    roleId: text("role_id")
      .notNull()
      .references(() => accessRole.id, { onDelete: "cascade" }),
    permission: text("permission").notNull(),
  },
  (table) => [
    uniqueIndex("accessRolePermission_role_permission_uidx").on(
      table.roleId,
      table.permission,
    ),
    index("accessRolePermission_permission_idx").on(table.permission),
  ],
);

export const accessAssignment = accessControlSchema.table(
  "access_assignment",
  {
    id: text("id").primaryKey(),
    roleId: text("role_id")
      .notNull()
      .references(() => accessRole.id, { onDelete: "restrict" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    teamId: text("team_id").references(() => team.id, {
      onDelete: "cascade",
    }),
    // Avoids PostgreSQL's "NULL values are distinct" rule in the active index.
    scopeKey: text("scope_key").notNull(),
    expiresAt: timestamp("expires_at"),
    grantedAt: timestamp("granted_at").notNull().defaultNow(),
    grantedBy: text("granted_by").references(() => user.id, {
      onDelete: "set null",
    }),
    revokedAt: timestamp("revoked_at"),
    revokedBy: text("revoked_by").references(() => user.id, {
      onDelete: "set null",
    }),
  },
  (table) => [
    uniqueIndex("accessAssignment_active_uidx")
      .on(table.userId, table.roleId, table.scopeKey)
      .where(sql`${table.revokedAt} is null`),
    index("accessAssignment_userId_idx").on(table.userId),
    index("accessAssignment_roleId_idx").on(table.roleId),
    index("accessAssignment_organizationId_idx").on(table.organizationId),
    index("accessAssignment_teamId_idx").on(table.teamId),
  ],
);

export const breakGlassElevation = accessControlSchema.table(
  "break_glass_elevation",
  {
    id: text("id").primaryKey(),
    sessionId: text("session_id").references(() => session.id, {
      onDelete: "set null",
    }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    permission: text("permission").notNull(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    teamId: text("team_id").references(() => team.id, {
      onDelete: "cascade",
    }),
    scopeKey: text("scope_key").notNull(),
    reason: text("reason").notNull(),
    activatedAt: timestamp("activated_at").notNull().defaultNow(),
    expiresAt: timestamp("expires_at").notNull(),
    endedAt: timestamp("ended_at"),
  },
  (table) => [
    index("breakGlassElevation_sessionId_idx").on(table.sessionId),
    index("breakGlassElevation_expiresAt_idx").on(table.expiresAt),
    index("breakGlassElevation_userId_organizationId_idx").on(
      table.userId,
      table.organizationId,
    ),
    index("breakGlassElevation_teamId_idx").on(table.teamId),
  ],
);

export const accessReview = accessControlSchema.table(
  "access_review",
  {
    id: text("id").primaryKey(),
    kind: text("kind").notNull(),
    subjectId: text("subject_id").notNull(),
    snapshot: text("snapshot").notNull(),
    decision: text("decision").notNull(),
    note: text("note").notNull(),
    reviewedAt: timestamp("reviewed_at").notNull(),
    reviewedBy: text("reviewed_by").references(() => user.id, {
      onDelete: "set null",
    }),
  },
  (table) => [
    index("accessReview_subject_idx").on(table.kind, table.subjectId),
  ],
);

export const teamDomain = accessControlSchema.table("team_domain", {
  teamId: text("team_id")
    .primaryKey()
    .references(() => team.id, { onDelete: "cascade" }),
  domainSlug: text("domain_slug").notNull(),
});
