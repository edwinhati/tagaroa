import { expect, test } from "@playwright/test";

test.describe("Sign-up page", () => {
  test("returns 404 or redirects", async ({ page }) => {
    const response = await page.goto("/sign-up");

    // Sign-up page doesn't exist, should return 404 or redirect
    if (response?.status() === 404) {
      await expect(page.getByText(/404|not found/i).first()).toBeVisible();
    } else {
      // Check if redirected to sign-in
      await expect(page).toHaveURL(/sign-in/);
    }
  });
});
