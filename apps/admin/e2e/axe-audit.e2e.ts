import { auditRoutes, hideDevOverlays } from "@apps/auth/e2e/axe-audit";
import { test } from "@playwright/test";

import { signInOperator } from "./operator";

test("administration routes have no serious axe violations", async ({
  page,
  context,
}) => {
  test.setTimeout(600_000);
  await hideDevOverlays(context);
  await signInOperator(page);
  const { user } = await (
    await page.request.get("http://localhost:18080/api/auth/get-session")
  ).json();
  await auditRoutes(page, [
    "/identity-access/work-queue",
    "/identity-access/people",
    `/identity-access/people/${user.id}`,
    "/identity-access/business-access/assignments",
    "/identity-access/business-access/roles",
    "/identity-access/privileged-access",
    "/identity-access/reviews",
    "/identity-access/activity",
    "/notifications/overview",
    "/notifications/templates",
    "/notifications/delivery",
    "/notifications/suppressions",
    "/subsidiaries",
  ]);
});
