import { expect, test } from "@playwright/test";

const emptyTransactionsResponse = {
  transactions: [],
  pagination: {
    page: 1,
    limit: 5,
    total: 0,
    total_pages: 0,
    has_next: false,
    has_prev: false,
  },
  aggregations: {},
};

test.describe("Transactions page", () => {
  test.beforeEach(async ({ page }) => {
    // Catch-all registered first; more specific routes registered after override it
    await page.route("**/api/finance/**", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({}),
      }),
    );

    await page.route("**/api/finance/transactions**", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(emptyTransactionsResponse),
      }),
    );

    await page.route("**/api/finance/accounts**", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ accounts: [] }),
      }),
    );

    await page.route("**/api/finance/budgets**", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ items: [] }),
      }),
    );

    await page.route("**/api/finance/transactions/types**", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(["INCOME", "EXPENSE", "TRANSFER"]),
      }),
    );

    await page.goto("/transactions");
  });

  test("renders search input", async ({ page }) => {
    await expect(page.getByPlaceholder("Search transactions...")).toBeVisible({
      timeout: 10000,
    });
  });

  test("renders Add Transaction button in toolbar", async ({ page }) => {
    // The toolbar has "Add Transaction" button; empty state also has "Add transaction" (lowercase)
    // Use exact match for the toolbar button
    await expect(
      page
        .getByRole("button", { name: "Add Transaction", exact: true })
        .first(),
    ).toBeVisible({ timeout: 10000 });
  });

  test("renders empty state when no transactions", async ({ page }) => {
    await expect(page.getByText("No Transactions Yet")).toBeVisible({
      timeout: 15000,
    });
  });

  test("opens Add New Transaction dialog on button click", async ({ page }) => {
    // Click the toolbar "Add Transaction" button (exact case, first match)
    await page
      .getByRole("button", { name: "Add Transaction", exact: true })
      .first()
      .click();
    await expect(
      page.getByRole("heading", { name: "Add New Transaction" }),
    ).toBeVisible({ timeout: 5000 });
  });

  test("dialog has required form fields", async ({ page }) => {
    await page
      .getByRole("button", { name: "Add Transaction", exact: true })
      .first()
      .click();
    const dialog = page.getByRole("dialog");
    await expect(
      dialog.getByRole("heading", { name: "Add New Transaction" }),
    ).toBeVisible({ timeout: 5000 });

    await expect(dialog.getByText("Amount")).toBeVisible();
    await expect(dialog.getByText("Date")).toBeVisible();
    await expect(dialog.getByText("Transaction Type")).toBeVisible();
    await expect(dialog.getByText("Currency", { exact: true })).toBeVisible();
    await expect(dialog.getByText("Account", { exact: true })).toBeVisible();
  });

  test("dialog cancel button closes the dialog", async ({ page }) => {
    await page
      .getByRole("button", { name: "Add Transaction", exact: true })
      .first()
      .click();
    await expect(
      page.getByRole("heading", { name: "Add New Transaction" }),
    ).toBeVisible({ timeout: 5000 });

    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(
      page.getByRole("heading", { name: "Add New Transaction" }),
    ).not.toBeVisible({ timeout: 5000 });
  });

  test("renders No results found when search returns empty", async ({
    page,
  }) => {
    const searchInput = page.getByPlaceholder("Search transactions...");
    await searchInput.waitFor({ timeout: 10000 });
    await searchInput.fill("nonexistent-query-xyz");
    await expect(page.getByText("No results found")).toBeVisible({
      timeout: 10000,
    });
  });
});
