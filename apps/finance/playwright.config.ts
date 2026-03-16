import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright configuration for Finance app E2E tests
 * Features:
 * - Multiple browser and device support
 * - Parallel execution with worker control
 * - Comprehensive reporting (HTML, list, GitHub/line)
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.e2e.ts",
  timeout: 30000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ["html", { open: "never" }],
    ["list"],
    process.env.CI ? ["github"] : ["line"],
  ],

  use: {
    baseURL: "http://localhost:3004",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "on-first-retry",
    actionTimeout: 10000,
    navigationTimeout: 15000,
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  webServer: {
    command: "bun run dev",
    url: "http://localhost:3004",
    reuseExistingServer: true,
    timeout: 120000,
  },
});
