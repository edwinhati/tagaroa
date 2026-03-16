import { test as base } from "@playwright/test";

/**
 * Extended test fixture with common utilities for auth app tests
 */
export const test = base.extend<{
  auth: {
    mockSignInError: (errorCode: string, message: string) => Promise<void>;
    mockSignUpError: (errorCode: string, message: string) => Promise<void>;
    mockForgotPasswordSuccess: () => Promise<void>;
    mockForgotPasswordError: (errorCode: string) => Promise<void>;
  };
}>({
  auth: async ({ page }, use) => {
    const auth = {
      mockSignInError: async (errorCode: string, message: string) => {
        await page.route("**/sign-in/email", (route) =>
          route.fulfill({
            status: 401,
            contentType: "application/json",
            body: JSON.stringify({
              error: errorCode,
              message,
            }),
          }),
        );
      },

      mockSignUpError: async (errorCode: string, message: string) => {
        await page.route("**/sign-up/email", (route) =>
          route.fulfill({
            status: 409,
            contentType: "application/json",
            body: JSON.stringify({
              error: errorCode,
              message,
            }),
          }),
        );
      },

      mockForgotPasswordSuccess: async () => {
        await page.route("**/forgot-password", (route) =>
          route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
              success: true,
              message: "Password reset link sent to your email",
            }),
          }),
        );
      },

      mockForgotPasswordError: async (errorCode: string) => {
        await page.route("**/forgot-password", (route) =>
          route.fulfill({
            status: 404,
            contentType: "application/json",
            body: JSON.stringify({
              error: errorCode,
              message: "No account found with this email",
            }),
          }),
        );
      },
    };

    await use(auth);
  },
});

export { expect } from "@playwright/test";
