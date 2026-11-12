import { test } from "@playwright/test";
import { auditRoutes, hideDevOverlays } from "@repo/test-support/axe-audit";
import { E2E_ADMIN, E2E_ORIGINS } from "@repo/test-support/e2e-stack";
import { signInOperator } from "@repo/test-support/sign-in";

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
    await signInOperator(page, E2E_ADMIN, E2E_ORIGINS.auth);
    await auditRoutes(page, ["/reauth"]);
  },
);
