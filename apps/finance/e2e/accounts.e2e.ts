import { expect, test } from "@playwright/test";

test.describe("Accounts page", () => {
  test.beforeEach(async ({ page }) => {
    await page.route("**/api/finance/**", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({}),
      }),
    );

    await page.route("**/api/finance/accounts**", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          accounts: [],
          pagination: {
            page: 1,
            limit: 10,
            total: 0,
            total_pages: 0,
            has_next: false,
            has_prev: false,
          },
          aggregations: {},
        }),
      }),
    );

    await page.route("**/api/finance/accounts/types**", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(["BANK", "CASH", "EWALLET"]),
      }),
    );

    await page.goto("/accounts");
  });

  test("renders Add account button in toolbar", async ({ page }) => {
    // The toolbar "Add account" button — use first() since empty state may also render one
    await expect(
      page.getByRole("button", { name: "Add account", exact: true }).first(),
    ).toBeVisible({ timeout: 10000 });
  });

  test("renders empty state when no accounts", async ({ page }) => {
    await expect(page.getByText("No Accounts Yet")).toBeVisible({
      timeout: 10000,
    });
  });

  test("opens Add New Account dialog on button click", async ({ page }) => {
    await page
      .getByRole("button", { name: "Add account", exact: true })
      .first()
      .click();
    await expect(
      page.getByRole("heading", { name: "Add New Account" }),
    ).toBeVisible({ timeout: 5000 });
  });

  test("dialog has required form fields", async ({ page }) => {
    await page
      .getByRole("button", { name: "Add account", exact: true })
      .first()
      .click();
    const dialog = page.getByRole("dialog");
    await expect(
      dialog.getByRole("heading", { name: "Add New Account" }),
    ).toBeVisible({ timeout: 5000 });

    await expect(dialog.getByText("Account Name")).toBeVisible();
    await expect(dialog.getByText("Account Type")).toBeVisible();
    await expect(dialog.getByText("Currency", { exact: true })).toBeVisible();
    await expect(dialog.getByText("Current Balance")).toBeVisible();
  });

  test("dialog cancel button closes the dialog", async ({ page }) => {
    await page
      .getByRole("button", { name: "Add account", exact: true })
      .first()
      .click();
    await expect(
      page.getByRole("heading", { name: "Add New Account" }),
    ).toBeVisible({ timeout: 5000 });

    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(
      page.getByRole("heading", { name: "Add New Account" }),
    ).not.toBeVisible({ timeout: 5000 });
  });
});
