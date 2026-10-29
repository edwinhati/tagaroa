/**
 * Every context's Drizzle tables in one module. `drizzle.config.ts` points at
 * this file, so a new context's schema is re-exported here to reach migrations.
 */
export * from "./modules/audit/infrastructure/persistence/drizzle/schema";
export * from "./modules/access-control/infrastructure/persistence/drizzle/schema";
export * from "./modules/auth/infrastructure/persistence/drizzle/schema";
export * from "./modules/directory/infrastructure/persistence/drizzle/schema";
export * from "./modules/hr/infrastructure/persistence/drizzle/schema";
export * from "./modules/notification/infrastructure/persistence/drizzle/schema";

export * from "./modules/auth/operations.schema";
