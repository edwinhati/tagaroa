/**
 * Every context's Drizzle tables in one module. `drizzle.config.ts` points at
 * this file, so a new context's schema is re-exported here to reach migrations.
 */
export * from "./modules/auth/infrastructure/persistence/drizzle/schema";
