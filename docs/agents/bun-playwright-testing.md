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

In this repo, `apps/auth` and `apps/admin` configure `chromium`, `firefox`, `webkit` and `mobile-chromium`. PRs run only `chromium`. All four run in the Sunday and manual matrix in `.github/workflows/qa.yml`.

### Firefox on macOS 27

On macOS 27, Playwright's bundled Firefox exits right after launch with `Could not find profile folder.` This happens with Playwright 1.64.1 (Firefox 157, `firefox-1555`). It also happens under Node and when Firefox is started directly with `-profile` or `-CreateProfile`. Bun, the config and the temp directory do not cause it. Gecko still reads the shared app-data directory `~/Library/Application Support/Firefox`, and macOS 27 TCC denies the terminal access to it. [microsoft/playwright#42768](https://github.com/microsoft/playwright/issues/42768) Mozilla fixed it in Firefox 158, and Playwright picks it up through a later Firefox roll. After `@playwright/test` moves to that release, run `playwright install firefox` and try a local launch again.

Linux CI is not affected. Until the fix ships, run the Firefox project against a Linux browser in Docker. The image tag must match the installed `@playwright/test` version:

```sh
docker run -d --rm --name pw-firefox -p 3999:3999 --init --ipc=host \
  mcr.microsoft.com/playwright:v1.64.1-noble \
  npx -y playwright@1.64.1 run-server --port 3999 --host 0.0.0.0
cd apps/auth   # then apps/admin; the two suites share the seeded operator
CI=1 PW_TEST_CONNECT_WS_ENDPOINT=ws://127.0.0.1:3999/ PW_TEST_CONNECT_EXPOSE_NETWORK='<loopback>' \
  bun run test:e2e --project firefox --reporter=list
docker stop pw-firefox
```

`<loopback>` sends the browser's `localhost` traffic back to the host, where `webServer` runs core and the Vite apps. `CI=1` turns on the same single retry the CI job has. Without it, the admin suite fails on timing in both Firefox and Chromium.

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
