import { SQL } from "bun";
import { drizzle } from "drizzle-orm/bun-sql";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
	throw new Error("DATABASE_URL is not defined");
}

export const db = drizzle({ client: new SQL(databaseUrl) });
