import { test } from "@playwright/test";
import { auditRoutes, hideDevOverlays } from "@repo/test-support/axe-audit";
import { E2E_ORIGINS, e2eOperator } from "@repo/test-support/e2e-stack";
import { signInOperator } from "@repo/test-support/sign-in";

// apps/workspace has no Playwright runner of its own; the admin config already
// serves it on 13002, and the operator's session cookie covers both origins.
test("workspace routes have no serious axe violations", async ({
  page,
  context,
}) => {
  test.setTimeout(120_000);
  await hideDevOverlays(context);
  await signInOperator(page, e2eOperator(), E2E_ORIGINS.admin);
  await auditRoutes(page, [`${E2E_ORIGINS.workspace}/`]);
});
