import { expect, test } from "@playwright/test";

test.describe("Finance app authentication redirects", () => {
  test("root path redirects to auth when not logged in", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/localhost:3001|sign-in/);
  });

  test("/accounts redirects to auth when not logged in", async ({ page }) => {
    await page.goto("/accounts");
    await expect(page).toHaveURL(/localhost:3001|sign-in/);
  });

  test("/transactions redirects to auth when not logged in", async ({
    page,
  }) => {
    await page.goto("/transactions");
    await expect(page).toHaveURL(/localhost:3001|sign-in/);
  });

  test("/budgets redirects to auth when not logged in", async ({ page }) => {
    await page.goto("/budgets");
    await expect(page).toHaveURL(/localhost:3001|sign-in/);
  });
});
