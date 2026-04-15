import { AsyncLocalStorage } from "node:async_hooks";
import type { BunSQLDatabase } from "drizzle-orm/bun-sql";

const asyncLocalStorage = new AsyncLocalStorage<BunSQLDatabase>();

export const TransactionalContext = {
  run<T>(tx: BunSQLDatabase, fn: () => Promise<T>): Promise<T> {
    return asyncLocalStorage.run(tx, fn);
  },

  getTx(): BunSQLDatabase | undefined {
    return asyncLocalStorage.getStore();
  },
};
