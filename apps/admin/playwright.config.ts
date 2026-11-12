import { defineConfig, devices } from "@playwright/test";
import { E2E_ORIGINS, portOf } from "@repo/test-support/e2e-stack";

const { admin: adminOrigin, auth, core: coreOrigin, workspace } = E2E_ORIGINS;
// Each worker signs in as its own seeded operator (`e2eOperator`), so this
// is also the number of operators the core service seeds. CI stays serial: a
// 4-vCPU Actions runner already hosts four Vite dev servers compiling on
// demand, and every extra browser starves them until 5 s waits time out.
const workers = process.env.CI ? 1 : 4;

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
      command: `E2E_CORE_PORT=${portOf(coreOrigin)} E2E_OPERATORS=${workers} E2E_TRUSTED_ORIGINS=${auth},${adminOrigin},${workspace} bun run start:e2e`,
      cwd: "../../servers/core",
      reuseExistingServer: false,
      timeout: 120_000,
      url: `${coreOrigin}/api/health/live`,
    },
    {
      // Avoid compiling and mounting developer tools on every test navigation.
      command: `NODE_ENV=production bun run dev:plain -- --mode production --port ${portOf(adminOrigin)}`,
      env: {
        VITE_AUTH_BASE_URL: coreOrigin,
        VITE_AUTH_URL: auth,
        VITE_WORKSPACE_URL: workspace,
      },
      reuseExistingServer: false,
      timeout: 120_000,
      url: adminOrigin,
    },
    {
      command: `NODE_ENV=production bun run dev:plain -- --mode production --port ${portOf(workspace)}`,
      cwd: "../workspace",
      env: {
        VITE_AUTH_BASE_URL: coreOrigin,
        VITE_AUTH_URL: auth,
        VITE_WORKSPACE_URL: workspace,
        VITE_ADMIN_URL: adminOrigin,
      },
      reuseExistingServer: false,
      timeout: 120_000,
      url: workspace,
    },
    {
      command: `bun run dev:plain -- --port ${portOf(auth)}`,
      cwd: "../auth",
      env: {
        VITE_AUTH_BASE_URL: coreOrigin,
        VITE_TRUSTED_REDIRECT_ORIGINS: `${adminOrigin},${workspace}`,
      },
      reuseExistingServer: false,
      timeout: 120_000,
      url: auth,
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
