import { expect, test } from "@playwright/test";

test.describe("Not found page", () => {
  test("shows Page Not Found for a nonexistent route", async ({ page }) => {
    await page.goto("/this-route-does-not-exist-xyz", {
      waitUntil: "domcontentloaded",
    });
    await expect(page.getByText("Page Not Found")).toBeVisible({
      timeout: 10000,
    });
  });

  test("Go Home link navigates to /", async ({ page }) => {
    await page.goto("/this-route-does-not-exist-xyz", {
      waitUntil: "domcontentloaded",
    });
    await expect(page.getByText("Page Not Found")).toBeVisible({
      timeout: 10000,
    });
    await page.getByRole("link", { name: "Go Home" }).click();
    await expect(page).toHaveURL(/^http:\/\/localhost:3004\/?$/);
  });
});
