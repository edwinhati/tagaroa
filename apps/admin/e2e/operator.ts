import { expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import { SQL } from "bun";

/**
 * The operator this worker signs in as. Tests change an operator's MFA, role
 * and sessions, so workers each get one of the accounts seeded by
 * `servers/core/test/e2e-admin.ts` instead of sharing a single account.
 */
export const operator = {
  email: `e2e-admin-${process.env.TEST_PARALLEL_INDEX ?? 0}@tagaroa.test`,
  password: "e2e-admin-password-12",
};

/**
 * Signs the operator in without the fixture-less authenticator step, then
 * re-enables MFA so pages still show the operator's real MFA state.
 */
export async function signInOperator(page: Page) {
  const sql = new SQL(
    process.env.TEST_DATABASE_URL ??
      "postgresql://tagaroa:tagaroa@127.0.0.1:5432/tagaroa_test",
  );
  try {
    await sql`update auth."user" set two_factor_enabled = false where email = ${operator.email}`;
    const signedIn = await page.request.post(
      "http://localhost:18080/api/auth/sign-in/email",
      { data: operator, headers: { origin: "http://localhost:13003" } },
    );
    expect(signedIn.ok()).toBe(true);
  } finally {
    await sql`update auth."user" set two_factor_enabled = true where email = ${operator.email}`;
    await sql.close();
  }
}
