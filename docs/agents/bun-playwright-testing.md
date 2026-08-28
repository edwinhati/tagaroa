# Bun and Playwright testing

## Recommended setup

Keep the two runners separate:

- Run unit and API/database integration tests with `bun test`.
- Run browser end-to-end tests with Playwright Test.

Bun 1.4 explicitly supports running `playwright test`, `playwright.config.ts`, UI mode, and Chromium under Bun. This means the Playwright CLI can use Bun's runtime. It does not make Playwright specs runnable by `bun test`. [Bun 1.4 release notes](https://bun.com/blog/bun-v1.4#playwright)

Install the runner as a pinned workspace development dependency:

```sh
bun add --dev --exact @playwright/test
```

`bun add --dev` writes to `devDependencies`, and `--exact` avoids an implicit version range. [Bun package manager documentation](https://bun.com/docs/pm/cli/add)

Run the locally installed CLI under Bun:

```sh
bunx --bun --no-install playwright test
```

`bunx` normally honors a CLI's `node` shebang. `--bun` forces Bun's runtime, while `--no-install` prevents an undeclared version from being fetched on demand. [Bun `bunx` documentation](https://bun.com/docs/pm/bunx#shebangs)

Playwright's own documentation currently lists npm, Yarn, and pnpm commands and names supported Node versions, but does not document Bun as an installation target. Bun 1.4 is the primary source for Bun runtime support. Keep Node available as a fallback if a Playwright update exposes a Bun compatibility bug. [Playwright installation and system requirements](https://playwright.dev/docs/intro)

## Browser installation

Browser binaries are separate from the npm package and are version-coupled to Playwright. Re-run the install command after updating `@playwright/test`. [Playwright browser documentation](https://playwright.dev/docs/browsers#install-browsers)

Start with Chromium only:

```sh
bunx --bun --no-install playwright install chromium
```

On Linux CI, install its OS dependencies too:

```sh
bunx --bun --no-install playwright install --with-deps chromium
```

Configure one `chromium` project. Add Firefox or WebKit only when cross-engine behavior is an acceptance requirement. Every configured project runs by default, so three browsers roughly multiply the browser work. [Playwright browser projects](https://playwright.dev/docs/browsers#run-tests-on-different-browsers)

## `webServer` configuration

Let Playwright own the application process:

```ts
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "e2e",
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  use: {
    baseURL: "http://localhost:3001",
    trace: "on-first-retry",
  },
  webServer: {
    command: "bun run dev:plain",
    url: "http://localhost:3001",
    reuseExistingServer: !process.env.CI,
  },
});
```

For this repository, `dev:plain` avoids starting the Impeccable Live helper during automated browser tests. Set `cwd` if the config does not live in the app workspace.

Playwright waits for `url` to return a ready HTTP status. It inherits the current environment, adds `PLAYWRIGHT_TEST=1`, reuses a local server when `reuseExistingServer` is true, and rejects an occupied port in CI when it is false. A single `baseURL` lets tests navigate with relative paths. [Playwright `webServer` documentation](https://playwright.dev/docs/test-webserver)

## Bun 1.4 integration-test options

For independent integration-test files, `bun test --parallel` uses worker processes and implies per-file isolation. Coverage and JUnit output merge across workers. Bun exposes `BUN_TEST_WORKER_ID` and `JEST_WORKER_ID`, which can select a unique database or port per worker. [Bun 1.4 test runner notes](https://bun.com/blog/bun-v1.4#bun-test)

Do not parallelize database integration tests against shared mutable tables. Run them serially first. Move to `--parallel` only after each worker has an isolated database or schema. For a large suite, Bun 1.4 also supports `--changed`, CI sharding, and duration-based scheduling with `--timings`; these are unnecessary for a small initial suite.
