import { defineConfig, devices } from "@playwright/test";

const adminOrigin = "http://localhost:13003";
const coreOrigin = "http://localhost:18080";
// Each worker signs in as its own seeded operator (`e2e/operator.ts`), so this
// is also the number of operators the core service seeds. A 4-vCPU Actions
// runner already hosts four dev servers; four browsers on top starve them.
const workers = process.env.CI ? 2 : 4;

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.e2e.ts",
  fullyParallel: true,
  workers,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "line",
  use: {
    baseURL: adminOrigin,
    trace: "retain-on-failure",
  },
  webServer: [
    {
      command: `E2E_CORE_PORT=18080 E2E_OPERATORS=${workers} E2E_TRUSTED_ORIGINS=http://localhost:13001,http://localhost:13003,http://localhost:13002 bun run start:e2e`,
      cwd: "../../servers/core",
      reuseExistingServer: false,
      timeout: 120_000,
      url: `${coreOrigin}/api/health/live`,
    },
    {
      command: "bun run dev:plain -- --port 13003",
      env: {
        VITE_AUTH_BASE_URL: coreOrigin,
        VITE_AUTH_URL: "http://localhost:13001",
        VITE_WORKSPACE_URL: "http://localhost:13002",
      },
      reuseExistingServer: false,
      timeout: 120_000,
      url: adminOrigin,
    },
    {
      command: "bun run dev:plain -- --port 13002",
      cwd: "../workspace",
      env: {
        VITE_AUTH_BASE_URL: coreOrigin,
        VITE_AUTH_URL: "http://localhost:13001",
        VITE_WORKSPACE_URL: "http://localhost:13002",
        VITE_ADMIN_URL: adminOrigin,
      },
      reuseExistingServer: false,
      timeout: 120_000,
      url: "http://localhost:13002",
    },
    {
      command: "bun run dev:plain -- --port 13001",
      cwd: "../auth",
      env: {
        VITE_AUTH_BASE_URL: coreOrigin,
        VITE_TRUSTED_REDIRECT_ORIGINS: `${adminOrigin},http://localhost:13002`,
      },
      reuseExistingServer: false,
      timeout: 120_000,
      url: "http://localhost:13001",
    },
  ],
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
    { name: "mobile-chromium", use: { ...devices["Pixel 7"] } },
  ],
});
