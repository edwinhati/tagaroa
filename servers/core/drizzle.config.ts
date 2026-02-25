import "dotenv/config";
import { defineConfig } from "drizzle-kit";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required for Drizzle configuration");
}

export default defineConfig({
  out: "./drizzle",
  schema: [
    "./src/modules/auth/infrastructure/persistence/drizzle/schema.ts",
    "./src/modules/auth/infrastructure/persistence/drizzle/schemas/*.ts",
    "./src/modules/finance/infrastructure/persistence/drizzle/schema.ts",
    "./src/modules/finance/infrastructure/persistence/drizzle/schemas/*.ts",
    "./src/modules/storage/infrastructure/persistence/drizzle/schema.ts",
    "./src/modules/storage/infrastructure/persistence/drizzle/schemas/*.ts",
  ],
  schemaFilter: ["auth", "finance", "storage"],
  dialect: "postgresql",
  dbCredentials: {
    url: databaseUrl,
  },
});
