import {
  date,
  decimal,
  index,
  integer,
  jsonb,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { snapshotSchema } from "../schema";

export const netWorth = snapshotSchema.table(
  "net_worth",
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
    baseCurrency: varchar("base_currency", { length: 3 }).notNull(),
    assetsBreakdown: jsonb("assets_breakdown")
      .$type<{
        liquidity: number;
        investments: number;
        fixedAssets: number;
      }>()
      .notNull(),
    liabilitiesBreakdown: jsonb("liabilities_breakdown")
      .$type<{
        revolving: number;
        termLoans: number;
      }>()
      .notNull(),
    fxRatesUsed: jsonb("fx_rates_used")
      .$type<Record<string, number>>()
      .notNull(),
    fxRateDate: date("fx_rate_date").notNull(),
    fxRateSource: varchar("fx_rate_source", { length: 50 }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    version: integer("version").notNull().default(1),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    s3Key: varchar("s3_key", { length: 512 }),
  },
  (table) => [
    index("idx_net_worth_user_id").on(table.userId),
    index("idx_net_worth_user_date").on(table.userId, table.snapshotDate),
    index("idx_net_worth_date").on(table.snapshotDate),
    index("idx_net_worth_archived").on(table.archivedAt),
  ],
);
