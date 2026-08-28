import { defineConfig, devices } from "@playwright/test";

const authOrigin = "http://localhost:3001";
const coreServiceOrigin = "http://localhost:8080";

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.e2e.ts",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "line",
  use: {
    baseURL: authOrigin,
    trace: "retain-on-failure",
  },
  webServer: [
    {
      command: "bun run start:e2e",
      cwd: "../../servers/core",
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      url: `${coreServiceOrigin}/api/health/live`,
    },
    {
      command: "bun run dev:plain",
      env: {
        VITE_AUTH_BASE_URL: coreServiceOrigin,
        VITE_POST_SIGNIN_URL: `${authOrigin}/locked-out`,
      },
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      url: authOrigin,
    },
  ],
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
