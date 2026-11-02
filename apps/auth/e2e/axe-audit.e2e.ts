import { expect, test } from "@playwright/test";
import { SQL } from "bun";

import { auditRoutes, hideDevOverlays } from "./axe-audit";

const core = "http://localhost:18080";

test.beforeEach(({ context }) => hideDevOverlays(context));

test("signed-out auth routes have no serious axe violations", async ({
  page,
}) => {
  test.setTimeout(180_000);
  await auditRoutes(page, [
    "/",
    "/locked-out?reason=expired",
    "/locked-out?reason=suspended",
    "/locked-out?reason=invalid",
  ]);
});

test(
  "reauthentication has no serious axe violations",
  { lock: "e2e-admin" },
  async ({ page }) => {
    test.setTimeout(120_000);
    const email = "e2e-admin@tagaroa.test";
    const sql = new SQL(
      process.env.TEST_DATABASE_URL ??
        "postgresql://tagaroa:tagaroa@127.0.0.1:5432/tagaroa_test",
    );
    try {
      await sql`update auth."user" set two_factor_enabled = false where email = ${email}`;
      const signedIn = await page.request.post(
        `${core}/api/auth/sign-in/email`,
        {
          data: { email, password: "e2e-admin-password-12" },
          headers: { origin: "http://localhost:13001" },
        },
      );
      expect(signedIn.ok()).toBe(true);
    } finally {
      await sql`update auth."user" set two_factor_enabled = true where email = ${email}`;
      await sql.close();
    }
    await auditRoutes(page, ["/reauth"]);
  },
);
