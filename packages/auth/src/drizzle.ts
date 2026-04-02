import { SQL } from "bun";
import { drizzle } from "drizzle-orm/bun-sql";

const databaseUrl = process.env.DATABASE_URL;
const isTest =
  process.env.NODE_ENV === "test" || process.env.BUN_ENV === "test";

if (!databaseUrl && !isTest) {
  throw new Error("DATABASE_URL is not defined");
}

let dbInstance: ReturnType<typeof drizzle> | null = null;

const getDatabase = (): ReturnType<typeof drizzle> => {
  if (!dbInstance) {
    if (!databaseUrl) {
      return {} as ReturnType<typeof drizzle>;
    }
    dbInstance = drizzle({ client: new SQL(databaseUrl) });
  }
  return dbInstance;
};

export const db = getDatabase();
