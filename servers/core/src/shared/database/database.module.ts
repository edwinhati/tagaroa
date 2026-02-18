import { Global, Module, type OnModuleDestroy } from "@nestjs/common";
import type { BunSQLDatabase } from "drizzle-orm/bun-sql";
import { getDatabase } from "../client/drizzle";
import { DRIZZLE } from "./database.constants";

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
      const client = (
        db as BunSQLDatabase & { $client: { close: () => Promise<void> } }
      ).$client;
      if (client && typeof client.close === "function") {
        await client.close();
      }
    }
  }
}
