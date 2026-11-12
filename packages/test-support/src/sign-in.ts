import { expect, type Page } from "@playwright/test";
import { SQL } from "bun";

import { E2E_ORIGINS, TEST_DATABASE_URL } from "./e2e-stack";

/**
 * Signs an operator in from `origin` without the authenticator step a fixture
 * cannot complete, then turns MFA back on so pages show the real state.
 */
export async function signInOperator(
  page: Page,
  operator: { email: string; password: string },
  origin: string,
) {
  const sql = new SQL(TEST_DATABASE_URL);
  try {
    await sql`update auth."user" set two_factor_enabled = false where email = ${operator.email}`;
    const signedIn = await page.request.post(
      `${E2E_ORIGINS.core}/api/auth/sign-in/email`,
      { data: operator, headers: { origin } },
    );
    expect(signedIn.ok()).toBe(true);
  } finally {
    await sql`update auth."user" set two_factor_enabled = true where email = ${operator.email}`;
    await sql.close();
  }
}
