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
const testPort = process.env.E2E_CORE_PORT ?? "8080";
const trustedOrigins =
  process.env.E2E_TRUSTED_ORIGINS ?? "http://localhost:3001";

export const testEnv = {
  BETTER_AUTH_SECRET: "integration-secret-at-least-thirty-two-characters",
  BETTER_AUTH_URL: `http://localhost:${testPort}`,
  DATABASE_URL: testDatabaseUrl,
  NODE_ENV: "test",
  // The queue is drained by hand in the tests, so a message can be inspected
  // where it was enqueued rather than raced against a timer.
  NOTIFICATION_WORKER: "0",
  PORT: testPort,
  // Provider credentials are fixtures: nothing is sent outside production, but
  // the webhooks still verify their signatures with these.
  TWILIO_ACCOUNT_SID: "AC-test-account",
  TWILIO_AUTH_TOKEN: "test-auth-token",
  TWILIO_FROM: "+15550100",
  WHATSAPP_APP_SECRET: "test-app-secret",
  TRUSTED_ORIGINS: trustedOrigins,
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
