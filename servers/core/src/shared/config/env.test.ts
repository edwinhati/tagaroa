import { expect, test } from "bun:test";

import { validateEnv } from "./env";

test("defaults the core service to port 8080", () => {
  const env = validateEnv({
    BETTER_AUTH_SECRET: "a".repeat(32),
    BETTER_AUTH_URL: "http://localhost:8080",
    DATABASE_URL: "postgresql://tagaroa:tagaroa@localhost/tagaroa",
  });

  expect(env.PORT).toBe(8080);
});
