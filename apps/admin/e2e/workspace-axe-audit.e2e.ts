import { auditRoutes, hideDevOverlays } from "@apps/auth/e2e/axe-audit";
import { test } from "@playwright/test";

import { signInOperator } from "./operator";

// apps/workspace has no Playwright runner of its own; the admin config already
// serves it on 13002, and the operator's session cookie covers both origins.
test("workspace routes have no serious axe violations", async ({
  page,
  context,
}) => {
  test.setTimeout(120_000);
  await hideDevOverlays(context);
  await signInOperator(page);
  await auditRoutes(page, ["http://localhost:13002/"]);
});
