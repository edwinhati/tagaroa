import { expect, test } from "@playwright/test";

test.describe("Budgets page", () => {
  test.beforeEach(async ({ page }) => {
    await page.route("**/api/finance/**", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({}),
      }),
    );

    // Budget by month/year — return null (no budget for this period)
    await page.route("**/api/finance/budgets/*/*", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: null }),
      }),
    );

    await page.goto("/budgets");
  });

  test("renders Budget Management title", async ({ page }) => {
    await expect(page.getByText("Budget Management")).toBeVisible({
      timeout: 10000,
    });
  });

  test("renders summary cards", async ({ page }) => {
    await expect(page.getByText("Total Budget")).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByText("Allocated")).toBeVisible();
    await expect(page.getByText("Remaining")).toBeVisible();
  });

  test("renders category filter input", async ({ page }) => {
    await expect(page.getByPlaceholder("Filter by category...")).toBeVisible({
      timeout: 10000,
    });
  });

  test("renders empty state when no budget exists", async ({ page }) => {
    await expect(page.getByText("No Budget Yet")).toBeVisible({
      timeout: 10000,
    });
  });

  test("opens Create Budget dialog from empty state", async ({ page }) => {
    await page.getByRole("button", { name: "Create budget" }).first().click();
    await expect(
      page.getByRole("heading", { name: "Add New Budget" }),
    ).toBeVisible({ timeout: 5000 });
  });

  test("Create Budget dialog has required form fields", async ({ page }) => {
    await page.getByRole("button", { name: "Create budget" }).first().click();
    const dialog = page.getByRole("dialog");
    await expect(
      dialog.getByRole("heading", { name: "Add New Budget" }),
    ).toBeVisible({ timeout: 5000 });

    await expect(dialog.getByText("Month", { exact: true })).toBeVisible();
    await expect(dialog.getByText("Year", { exact: true })).toBeVisible();
    await expect(dialog.getByText("Currency", { exact: true })).toBeVisible();
    await expect(
      dialog.getByText("Budget Amount", { exact: true }),
    ).toBeVisible();
  });

  test("Create Budget dialog cancel button closes the dialog", async ({
    page,
  }) => {
    await page.getByRole("button", { name: "Create budget" }).first().click();
    await expect(
      page.getByRole("heading", { name: "Add New Budget" }),
    ).toBeVisible({ timeout: 5000 });

    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(
      page.getByRole("heading", { name: "Add New Budget" }),
    ).not.toBeVisible({ timeout: 5000 });
  });
});
