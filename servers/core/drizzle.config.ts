import "dotenv/config";
import { defineConfig } from "drizzle-kit";

const databaseUrl = process.env.DATABASE_URL;

// Allow static analysis tools (knip, etc.) to load the config without DATABASE_URL
if (
  !databaseUrl &&
  process.env.NODE_ENV !== "test" &&
  !process.argv.some((arg) => arg.includes("knip"))
) {
  throw new Error("DATABASE_URL is required for Drizzle configuration");
}

export default defineConfig({
  out: "./drizzle",
  schema: [
    "../../packages/auth/src/db/schema.ts",
    "../../packages/auth/src/db/schemas/*.ts",
    "./src/modules/finance/infrastructure/persistence/drizzle/schema.ts",
    "./src/modules/finance/infrastructure/persistence/drizzle/schemas/*.ts",
    "./src/modules/storage/infrastructure/persistence/drizzle/schema.ts",
    "./src/modules/storage/infrastructure/persistence/drizzle/schemas/*.ts",
    "./src/modules/investment/infrastructure/persistence/drizzle/schema.ts",
    "./src/modules/investment/infrastructure/persistence/drizzle/schemas/*.ts",
  ],
  schemaFilter: ["auth", "finance", "storage", "investment"],
  dialect: "postgresql",
  dbCredentials: {
    url: databaseUrl || "postgresql://localhost:5432/tagaroa",
  },
});
