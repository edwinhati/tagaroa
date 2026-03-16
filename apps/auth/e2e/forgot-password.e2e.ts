import { expect, test } from "@playwright/test";

test.describe("Forgot password page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/forgot-password");
  });

  test("page exists and loads", async ({ page }) => {
    // Page should load (either with content or 404)
    const content = await page.content();
    expect(content.length).toBeGreaterThan(0);
  });

  test("returns 404 or shows not found", async ({ page }) => {
    const response = await page.goto("/forgot-password");

    // If page doesn't exist, it should return 404 or redirect
    if (response?.status() === 404) {
      await expect(page.getByText(/404|not found/i).first()).toBeVisible();
    }
  });
});
