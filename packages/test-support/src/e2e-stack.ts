/**
 * The local stack the browser suites run against: servers/core's `start:e2e`
 * and each app's Vite dev server, on ports clear of `bun dev`'s.
 */
export const E2E_ORIGINS = {
  admin: "http://localhost:13003",
  auth: "http://localhost:13001",
  core: "http://localhost:18080",
  engineering: "http://localhost:13010",
  workspace: "http://localhost:13002",
} as const;

export const portOf = (origin: string) => new URL(origin).port;

/** The database integration and browser suites share. */
export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  "postgresql://tagaroa:tagaroa@127.0.0.1:5432/tagaroa_test";

/**
 * The super-admin servers/core seeds for the suites (`test/e2e-admin.ts`).
 * Fixtures, not secrets. Workers that change an operator's MFA, role and
 * sessions each get a numbered copy instead of sharing this one.
 */
export const E2E_ADMIN = {
  email: "e2e-admin@tagaroa.test",
  password: "e2e-admin-password-12",
} as const;

export const e2eOperator = (
  index: string | number = process.env.TEST_PARALLEL_INDEX ?? 0,
) => ({
  email: `e2e-admin-${index}@tagaroa.test`,
  password: E2E_ADMIN.password,
});
