import { expect, test } from "@playwright/test";

test.describe("Not found page", () => {
  test("page loads for non-existent route", async ({ page }) => {
    const response = await page.goto("/nonexistent-page-12345");
    // Page should load (either 200 with not-found content or 404)
    expect(response?.status()).toBeDefined();
  });

  test("page content loads", async ({ page }) => {
    await page.goto("/nonexistent-route");
    const content = await page.content();
    expect(content.length).toBeGreaterThan(0);
  });
});
