import { defineConfig } from "drizzle-kit";

const databaseUrl = process.env.DATABASE_URL;

export default defineConfig({
  ...(databaseUrl ? { dbCredentials: { url: databaseUrl } } : {}),
  dialect: "postgresql",
  out: "./drizzle",
  schema: "./src/schema.registry.ts",
  schemaFilter: [
    "access_control",
    "auth",
    "identity_operations",
    "directory",
    "hr",
    "notification",
  ],
});
