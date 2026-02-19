import {
  date,
  decimal,
  index,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { financeSchema } from "../schema";

export const netWorthSnapshots = financeSchema.table(
  "net_worth_snapshots",
  {
    id: uuid("id").primaryKey(),
    userId: uuid("user_id").notNull(),
    snapshotDate: date("snapshot_date").notNull(),
    totalAssets: decimal("total_assets", { precision: 15, scale: 2 })
      .notNull()
      .default("0"),
    totalLiabilities: decimal("total_liabilities", { precision: 15, scale: 2 })
      .notNull()
      .default("0"),
    netWorth: decimal("net_worth", { precision: 15, scale: 2 })
      .notNull()
      .default("0"),
    currency: varchar("currency", { length: 3 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index("idx_net_worth_snapshots_user_id").on(table.userId),
    index("idx_net_worth_snapshots_user_date").on(
      table.userId,
      table.snapshotDate,
    ),
  ],
);
