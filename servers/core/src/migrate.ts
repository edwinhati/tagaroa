import { resolve } from "node:path";

import { SQL } from "bun";
import { drizzle } from "drizzle-orm/bun-sql";
import { migrate } from "drizzle-orm/bun-sql/migrator";

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required");

  const client = new SQL(databaseUrl);
  try {
    // `dist/migrate.js` sits beside `drizzle/` in the image, as `src/` does here.
    await migrate(drizzle({ client }), {
      migrationsFolder: resolve(__dirname, "../drizzle"),
    });
    console.log("Migrations applied.");
  } finally {
    await client.close();
  }
}

void main().catch(() => {
  console.error("Migration failed. Check connectivity and migration state.");
  process.exitCode = 1;
});
