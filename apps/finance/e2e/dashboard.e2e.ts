import { expect, test } from "@playwright/test";

test.describe("Finance app", () => {
  test("app responds on port 3004", async ({ page }) => {
    const response = await page.goto("/");
    expect(response).not.toBeNull();
    expect(response?.status()).toBeDefined();
  });
});
