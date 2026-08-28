import { resolve } from "node:path";

import { SQL } from "bun";
import { drizzle } from "drizzle-orm/bun-sql";
import { migrate } from "drizzle-orm/bun-sql/migrator";

const coreServiceRoot = resolve(import.meta.dir, "..");
const composeFile = resolve(
  coreServiceRoot,
  "../../infra/docker/docker-compose.yml",
);

const testDatabaseUrl =
  process.env.TEST_DATABASE_URL ??
  "postgresql://tagaroa:tagaroa@127.0.0.1:5432/tagaroa_test";

export const testEnv = {
  BETTER_AUTH_SECRET: "integration-secret-at-least-thirty-two-characters",
  BETTER_AUTH_URL: "http://localhost:8080",
  DATABASE_URL: testDatabaseUrl,
  NODE_ENV: "test",
  PORT: "8080",
  TRUSTED_ORIGINS: "http://localhost:3001",
} as const;

const run = (command: string[]) => {
  const result = Bun.spawnSync(command, {
    cwd: coreServiceRoot,
    env: { ...process.env, ...testEnv },
    stderr: "inherit",
    stdout: "inherit",
  });
  if (!result.success) throw new Error(`${command.join(" ")} failed`);
};

export async function prepareTestDatabase(): Promise<void> {
  run([
    "docker",
    "compose",
    "-f",
    composeFile,
    "up",
    "-d",
    "--wait",
    "postgres",
  ]);

  if (!process.env.TEST_DATABASE_URL) {
    const sql = new SQL(
      "postgresql://postgres:postgres@127.0.0.1:5432/postgres",
    );
    const [database] = await sql`
      SELECT 1 FROM pg_database WHERE datname = 'tagaroa_test'
    `;
    if (!database) {
      await sql.unsafe("CREATE DATABASE tagaroa_test OWNER tagaroa");
    }
    await sql.close();
  }

  const client = new SQL(testDatabaseUrl);
  await migrate(drizzle({ client }), {
    migrationsFolder: resolve(coreServiceRoot, "drizzle"),
  });
  await client.close();
}
