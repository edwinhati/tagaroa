import { expect, test } from "@playwright/test";

test.describe("Sign-in page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/sign-in");
  });

  test("renders sign-in form correctly with all elements", async ({ page }) => {
    // Check page title
    await expect(page).toHaveTitle("Tagaroa - Authentication");

    // Check form elements
    await expect(page.getByPlaceholder("Enter your email")).toBeVisible();
    await expect(page.getByPlaceholder("••••••••")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Sign in with Credentials" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Continue with Google" }),
    ).toBeVisible();

    // Check forgot password link
    await expect(
      page.getByRole("link", { name: /forgot password/i }),
    ).toBeVisible();
  });

  test("email input has correct autocomplete", async ({ page }) => {
    const emailInput = page.getByPlaceholder("Enter your email");
    await expect(emailInput).toHaveAttribute("autocomplete", "email");
  });

  test("password input has correct type and autocomplete", async ({ page }) => {
    const passwordInput = page.getByPlaceholder("••••••••");
    await expect(passwordInput).toHaveAttribute("type", "password");
    await expect(passwordInput).toHaveAttribute(
      "autocomplete",
      "current-password",
    );
  });

  test("password show/hide toggle works", async ({ page }) => {
    const passwordInput = page.getByPlaceholder("••••••••");
    await expect(passwordInput).toHaveAttribute("type", "password");

    // Click show password button
    await page.getByRole("button", { name: "Show password" }).click();
    await expect(passwordInput).toHaveAttribute("type", "text");

    // Click hide password button
    await page.getByRole("button", { name: "Hide password" }).click();
    await expect(passwordInput).toHaveAttribute("type", "password");
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

  test("shows validation error for invalid email format", async ({ page }) => {
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
    // Mock the better-auth sign-in endpoint
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
    await expect(page.getByText(/invalid email or password/i)).toBeVisible({
      timeout: 10000,
    });
  });

  test("shows error when server returns 500", async ({ page }) => {
    await page.route("**/sign-in/email", (route) =>
      route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({
          error: "INTERNAL_SERVER_ERROR",
          message: "Something went wrong",
        }),
      }),
    );

    await page.getByPlaceholder("Enter your email").fill("user@example.com");
    await page.getByPlaceholder("••••••••").fill("ValidPass1!");
    await page
      .getByRole("button", { name: "Sign in with Credentials" })
      .click();

    await expect(page.getByText(/something went wrong/i)).toBeVisible({
      timeout: 10000,
    });
  });

  test("shows loading state during form submission", async ({ page }) => {
    // Delay the response to see loading state
    await page.route("**/sign-in/email", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 100));
      await route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({
          error: "INVALID_EMAIL_OR_PASSWORD",
          message: "Invalid email or password",
        }),
      });
    });

    await page.getByPlaceholder("Enter your email").fill("user@example.com");
    await page.getByPlaceholder("••••••••").fill("ValidPass1!");
    await page
      .getByRole("button", { name: "Sign in with Credentials" })
      .click();

    // Check for loading state (button shows "Signing in...")
    await expect(page.getByText("Signing in...")).toBeVisible({
      timeout: 5000,
    });
  });

  test("forgot password link navigates to /forgot-password", async ({
    page,
  }) => {
    await page.getByRole("link", { name: /forgot password/i }).click();
    await expect(page).toHaveURL(/forgot-password/);
  });

  test("form persists email value on validation error", async ({ page }) => {
    const email = "test@example.com";
    await page.getByPlaceholder("Enter your email").fill(email);
    await page
      .getByRole("button", { name: "Sign in with Credentials" })
      .click();

    // Email should still be in the field after validation error
    await expect(page.getByPlaceholder("Enter your email")).toHaveValue(email);
  });

  test("pressing Enter submits the form", async ({ page }) => {
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

    await page.getByPlaceholder("Enter your email").fill("user@example.com");
    await page.getByPlaceholder("••••••••").fill("ValidPass1!");
    await page.getByPlaceholder("••••••••").press("Enter");

    await expect(page.getByText(/invalid email or password/i)).toBeVisible({
      timeout: 10000,
    });
  });

  test("page has form element", async ({ page }) => {
    await expect(page.locator("form")).toBeVisible();
  });

  test("card header displays correctly", async ({ page }) => {
    // Card title might be h2 or other heading level
    await expect(page.getByText("Welcome back")).toBeVisible();
    await expect(
      page.getByText("Sign in to your account to continue"),
    ).toBeVisible();
  });
});
