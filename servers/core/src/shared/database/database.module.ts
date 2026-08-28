import {
  type DynamicModule,
  Global,
  Inject,
  Module,
  type OnModuleDestroy,
} from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { SQL } from "bun";
import { drizzle } from "drizzle-orm/bun-sql";

import type { AppEnv } from "../config/env";

export const DATABASE = Symbol("DATABASE");

type DatabaseSchema = Record<string, unknown>;

const createDatabase = (databaseUrl: string, schema: DatabaseSchema) =>
  drizzle({ client: new SQL(databaseUrl), schema });

export type Database = ReturnType<typeof createDatabase>;

@Global()
@Module({})
export class DatabaseModule implements OnModuleDestroy {
  static register(schema: DatabaseSchema): DynamicModule {
    return {
      exports: [DATABASE],
      imports: [ConfigModule],
      module: DatabaseModule,
      providers: [
        {
          inject: [ConfigService],
          provide: DATABASE,
          useFactory: (config: ConfigService<AppEnv, true>) =>
            createDatabase(config.get("DATABASE_URL", { infer: true }), schema),
        },
      ],
    };
  }

  constructor(@Inject(DATABASE) private readonly database: Database) {}

  async onModuleDestroy(): Promise<void> {
    await this.database.$client.close();
  }
}
