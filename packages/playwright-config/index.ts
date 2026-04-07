import {
  defineConfig,
  devices,
  type PlaywrightTestConfig,
} from "@playwright/test";

export interface PlaywrightAppOptions {
  port: number;
}

export function createPlaywrightConfig(
  options: PlaywrightAppOptions,
): PlaywrightTestConfig {
  const { port } = options;
  const baseURL = `http://localhost:${port}`;

  return defineConfig({
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
      baseURL,
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
      url: baseURL,
      reuseExistingServer: true,
      timeout: 120000,
    },
  });
}
