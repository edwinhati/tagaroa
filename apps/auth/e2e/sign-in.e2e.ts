import { expect, test } from "@playwright/test";

test.describe("Sign-in page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/sign-in");
  });

  test("renders sign-in form correctly", async ({ page }) => {
    await expect(page.getByPlaceholder("Enter your email")).toBeVisible();
    await expect(page.getByPlaceholder("••••••••")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Sign in with Credentials" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Continue with Google" }),
    ).toBeVisible();
  });

  test("shows validation errors on empty submit", async ({ page }) => {
    await page
      .getByRole("button", { name: "Sign in with Credentials" })
      .click();

    // React Hook Form + Zod validates on submit
    await expect(
      page.getByText("Please enter a valid email address."),
    ).toBeVisible({
      timeout: 5000,
    });

    // Page should stay on sign-in (no navigation on validation failure)
    await expect(page).toHaveURL(/sign-in/);
  });

  test("shows validation error for invalid email", async ({ page }) => {
    await page.getByPlaceholder("Enter your email").fill("not-an-email");
    await page.getByPlaceholder("••••••••").fill("password123");
    await page
      .getByRole("button", { name: "Sign in with Credentials" })
      .click();

    await expect(
      page.getByText("Please enter a valid email address."),
    ).toBeVisible({
      timeout: 5000,
    });
  });

  test("shows validation error for short password", async ({ page }) => {
    await page.getByPlaceholder("Enter your email").fill("user@example.com");
    await page.getByPlaceholder("••••••••").fill("abc");
    await page
      .getByRole("button", { name: "Sign in with Credentials" })
      .click();

    // Zod .min(8) message
    await expect(page.getByText(/at least 8 character/i)).toBeVisible({
      timeout: 5000,
    });
  });

  test("shows auth error for invalid credentials", async ({ page }) => {
    // Mock the better-auth sign-in endpoint (calls NEXT_PUBLIC_API_URL/api/auth/sign-in/email)
    // to avoid requiring the core server to be running
    await page.route("**/sign-in/email", (route) =>
      route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({
          error: "INVALID_EMAIL_OR_PASSWORD",
          message: "Invalid email or password",
        }),
      }),
    );

    await page
      .getByPlaceholder("Enter your email")
      .fill("nonexistent@example.com");
    await page.getByPlaceholder("••••••••").fill("ValidPass1!");
    await page
      .getByRole("button", { name: "Sign in with Credentials" })
      .click();

    // sign-in-form.tsx sets authError state → renders <div role="alert">
    await expect(page.getByRole("alert")).toBeVisible({ timeout: 10000 });
  });

  test("forgot password link navigates to /forgot-password", async ({
    page,
  }) => {
    await page.getByRole("link", { name: /forgot password/i }).click();
    await expect(page).toHaveURL(/forgot-password/);
  });
});
