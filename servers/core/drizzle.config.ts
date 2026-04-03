import "dotenv/config";
import { defineConfig } from "drizzle-kit";

const databaseUrl = process.env.DATABASE_URL!;

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
    url: databaseUrl,
  },
});
