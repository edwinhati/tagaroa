import {
  index,
  integer,
  pgSchema,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const storageSchema = pgSchema("storage");

export const files = storageSchema.table(
  "files",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    // S3 metadata
    key: varchar("key", { length: 500 }).notNull().unique(), // S3 key: uploads/{userId}/{fileId}
    bucket: varchar("bucket", { length: 100 }).notNull(), // Bucket name
    url: varchar("url", { length: 2048 }), // Public/CDN URL (optional)

    // File metadata
    size: integer("size").notNull(), // File size in bytes
    contentType: varchar("content_type", { length: 100 }).notNull(),
    originalName: varchar("original_name", { length: 255 }).notNull(),

    // Security
    userId: uuid("user_id").notNull(), // File owner
    status: varchar("status", { length: 20 }).notNull().default("PENDING"), // PENDING, SCANNED, INFECTED
    scanResult: text("scan_result"), // Virus scan result/log

    // Soft delete & audit
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    version: integer("version").default(1).notNull(),
  },
  (table) => ({
    userIdIdx: index("files_user_id_idx").on(table.userId),
    statusIdx: index("files_status_idx").on(table.status),
    createdAtIdx: index("files_created_at_idx").on(table.createdAt),
  }),
);
