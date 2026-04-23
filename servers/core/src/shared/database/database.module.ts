import { Global, Module, type OnModuleDestroy } from "@nestjs/common";
import type { BunSQLDatabase } from "drizzle-orm/bun-sql";
import { DRIZZLE } from "./database.constants";
import { getDatabase } from "./drizzle-client";

@Global()
@Module({
  providers: [
    {
      provide: DRIZZLE,
      useFactory: () => getDatabase(),
    },
  ],
  exports: [DRIZZLE],
})
export class DatabaseModule implements OnModuleDestroy {
  async onModuleDestroy() {
    const db = getDatabase() as unknown as BunSQLDatabase | null;
    if (db && "$client" in db) {
      const client = db.$client as { close?: () => Promise<void> } | undefined;
      if (client && typeof client.close === "function") {
        await client.close();
      }
    }
  }
}
