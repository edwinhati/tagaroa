import { expect, test } from "@playwright/test";

const emptyPagination = {
  page: 1,
  limit: 10,
  total: 0,
  total_pages: 0,
  has_next: false,
  has_prev: false,
};

test.describe("Dashboard page", () => {
  test.beforeEach(async ({ page }) => {
    // Catch-all for all finance API calls first (lowest priority — registered first, matched last)
    await page.route("**/api/finance/**", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({}),
      }),
    );

    await page.route("**/api/finance/dashboard/summary**", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          income: { amount: 0, currency: "IDR" },
          expenses: { amount: 0, currency: "IDR" },
          savings: { amount: 0, currency: "IDR" },
          net_worth: 0,
        }),
      }),
    );

    await page.route("**/api/finance/transactions/trends**", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ trends: [] }),
      }),
    );

    await page.route("**/api/finance/accounts**", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ accounts: [], pagination: emptyPagination }),
      }),
    );

    await page.route("**/api/finance/net-worth**", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ net_worth: 0, assets: 0, liabilities: 0 }),
      }),
    );

    await page.goto("/");
  });

  test("renders sidebar navigation items with all section names", async ({
    page,
  }) => {
    // Sidebar renders nav item names as text spans inside SidebarMenuButton
    await expect(page.getByText("Dashboard").first()).toBeVisible();
    await expect(page.getByText("Accounts").first()).toBeVisible();
    await expect(page.getByText("Budgets")).toBeVisible();
    await expect(page.getByText("Transactions")).toBeVisible();
    await expect(page.getByText("Assets")).toBeVisible();
    await expect(page.getByText("Liabilities")).toBeVisible();
  });

  test("renders dashboard section headings", async ({ page }) => {
    await expect(
      page.getByRole("heading", { name: "Net Worth" }),
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Financial Trends" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Breakdown" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Budget Analysis" }),
    ).toBeVisible();
  });

  test("renders main Dashboard heading", async ({ page }) => {
    await expect(
      page.getByRole("heading", { name: "Dashboard" }),
    ).toBeVisible();
  });

  test("navigating to /accounts via URL works", async ({ page }) => {
    await page.goto("/accounts");
    await expect(page).toHaveURL(/\/accounts/);
  });

  test("navigating to /transactions via URL works", async ({ page }) => {
    await page.goto("/transactions");
    await expect(page).toHaveURL(/\/transactions/);
  });
});
