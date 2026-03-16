import { expect, test } from "@playwright/test";

test.describe("Auth app navigation", () => {
  test("navigates from root to sign-in", async ({ page }) => {
    await page.goto("/");
    // Root should redirect to sign-in
    await expect(page).toHaveURL(/sign-in/);
  });

  test("forgot password link works from sign-in", async ({ page }) => {
    await page.goto("/sign-in");
    await page.getByRole("link", { name: /forgot password/i }).click();
    await expect(page).toHaveURL(/forgot-password/);
  });

  test("404 page handles unknown routes", async ({ page }) => {
    await page.goto("/nonexistent-route-12345");

    // Should show 404 page
    await expect(
      page.getByText(/404|not found|page not found/i).first(),
    ).toBeVisible({ timeout: 10000 });
  });

  test("404 page has Go Home link", async ({ page }) => {
    await page.goto("/nonexistent-route");

    // Wait for 404 page to load
    await expect(page.getByText("Page Not Found")).toBeVisible({
      timeout: 10000,
    });

    const goHomeLink = page.getByRole("link", { name: "Go Home" });
    await expect(goHomeLink).toBeVisible();

    await goHomeLink.click();
    // Home redirects to sign-in
    await expect(page).toHaveURL(/sign-in/);
  });
});
