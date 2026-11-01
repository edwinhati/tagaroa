import { defineConfig, devices } from "@playwright/test";

// The deployed topology from `infra/dev/browsers.test.sh`, which starts the
// stack and runs this; not part of `test:e2e`.
export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.deployed.ts",
  // One user, one sign-in per browser: core allows three sign-ins per window.
  workers: 1,
  reporter: "line",
  use: { ignoreHTTPSErrors: true, trace: "retain-on-failure" },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
  ],
});
