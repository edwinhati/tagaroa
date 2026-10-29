import type { DynamicModule } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { DrizzleModule, getDrizzleToken } from "@nestjs/drizzle";
import { SQL } from "bun";
import { drizzle } from "drizzle-orm/bun-sql";

import type { AppEnv } from "../config/env";

export const DATABASE = getDrizzleToken();

type DatabaseSchema = Record<string, unknown>;

const createDatabase = (databaseUrl: string, schema: DatabaseSchema) =>
  drizzle({ client: new SQL(databaseUrl), schema });

export type Database = ReturnType<typeof createDatabase>;

/**
 * `@nestjs/drizzle` owns the provider's lifecycle: it is global, and it closes
 * `db.$client` on application shutdown. The database is still built here so
 * `Database` keeps the schema's types.
 */
export const DatabaseModule = {
  register: (schema: DatabaseSchema): DynamicModule =>
    DrizzleModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppEnv, true>) => ({
        db: createDatabase(config.get("DATABASE_URL", { infer: true }), schema),
      }),
    }),
};
