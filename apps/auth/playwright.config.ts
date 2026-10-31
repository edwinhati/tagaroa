import { defineConfig, devices } from "@playwright/test";

const authOrigin = "http://localhost:13001";
const coreServiceOrigin = "http://localhost:18080";
const workspaceOrigin = "http://localhost:13002";

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.e2e.ts",
  // Tests that sign in as the seeded operator change its MFA, role and
  // sessions, so they hold the "e2e-admin" lock and run one at a time. The rest
  // never touch it and run beside them.
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "line",
  use: {
    baseURL: authOrigin,
    trace: "retain-on-failure",
  },
  webServer: [
    {
      command:
        "E2E_CORE_PORT=18080 E2E_TRUSTED_ORIGINS=http://localhost:13001,http://localhost:13002,http://localhost:13010 PASSKEY_ORIGINS=http://localhost:13001,http://localhost:13002 PASSKEY_RP_ID=localhost bun run start:e2e",
      cwd: "../../servers/core",
      reuseExistingServer: false,
      timeout: 120_000,
      url: `${coreServiceOrigin}/api/health/live`,
    },
    {
      command: "bun run dev:plain -- --port 13001",
      env: {
        VITE_AUTH_BASE_URL: coreServiceOrigin,
        VITE_POST_SIGNIN_URL: `${authOrigin}/locked-out`,
        VITE_TRUSTED_REDIRECT_ORIGINS: `${workspaceOrigin},http://localhost:13010`,
      },
      reuseExistingServer: false,
      timeout: 120_000,
      url: authOrigin,
    },
    {
      command: "bun run dev:plain -- --port 13002",
      cwd: "../workspace",
      env: {
        VITE_AUTH_BASE_URL: coreServiceOrigin,
        VITE_AUTH_URL: authOrigin,
      },
      reuseExistingServer: false,
      timeout: 120_000,
      url: workspaceOrigin,
    },
    {
      command: "bun run dev:plain -- --port 13010",
      cwd: "../../domains/engineering",
      env: {
        VITE_AUTH_BASE_URL: coreServiceOrigin,
        VITE_AUTH_URL: authOrigin,
        VITE_WORKSPACE_URL: workspaceOrigin,
      },
      reuseExistingServer: false,
      timeout: 120_000,
      url: "http://localhost:13010/engineering",
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
