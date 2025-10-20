import { SQL } from "bun";
import { drizzle } from "drizzle-orm/bun-sql";

export const db = drizzle({ client: new SQL(process.env.DATABASE_URL!) });
