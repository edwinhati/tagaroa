# investment

## 0.5.0

### Minor Changes

- 0d3c1ee: - Added detail sheets for accounts, assets, budgets, liabilities, and positions across `finance` and `investment` applications.
  - Centralized UI detail elements and file utilities into `@repo/common` to fix code duplication and improve consistency.
  - Improved type handling and value formatting across finance detail components.

## 0.4.5

### Patch Changes

- 6e07c11: ## Sentry Observability Improvements

  ### Bug Fixes

  - **Fixed Sentry SDK disconnected in all Next.js apps** — `getEnvVar()` in `@repo/sentry-config` used dynamic bracket access (`process.env[name]`) which Next.js/webpack cannot statically inline in the browser. Replaced with an explicit static map so all `NEXT_PUBLIC_SENTRY_*` variables are correctly inlined at build time, allowing `Sentry.init()` to run on the client.

  - **Fixed `onRouterTransitionStart` warning** — Added the required `export const onRouterTransitionStart = Sentry.captureRouterTransitionStart` to all `instrumentation-client.ts` files, sourced via `@repo/sentry-config/nextjs/client` to keep `@sentry/nextjs` as a shared internal dependency.

  ### Features

  - **Sentry metrics support** — Updated `SentryTestConsole` to use the correct `@sentry/nextjs` v10 metrics API (`Sentry.metrics.count`, `Sentry.metrics.distribution`, `Sentry.metrics.gauge`) so metrics are sent to Sentry's ingestion endpoint and appear in Explore → Metrics.

  - **Sentry logger support in `core-service`** — Added `consoleLoggingIntegration` to `instrument.ts` so `console.log/warn/error` calls are forwarded to Sentry Logs. Added dedicated debug endpoints:

    - `GET /api/debug/sentry-metrics` — emits count, gauge, and distribution metrics
    - `GET /api/debug/sentry-logs` — emits logs at all severity levels via `Sentry.logger.*` and console

  - **`/sentry-test` page bypasses auth** — The Sentry test console page is now accessible without authentication in development. Each app's `sentry-test/` directory has a passthrough `layout.tsx` that opts the page out of the root sidebar `template.tsx`, so the console renders as a standalone full-page UI.

## 0.4.4

### Patch Changes

- dd30fd3: ## CI/CD Simplification

  - Remove selective deploy logic (detect-changes job) - deploy all apps on every push
  - Use `--affected` flag instead of `--filter="...[origin/main]"` for build/test
  - Use static deploy matrix with include instead of dynamic matrix from detect-changes
  - Add knip to build matrix in all workflows
  - Fix knip to use `bunx knip --no-progress` with limited scope
  - Change changeset version commit message to `ci: version bump`
  - Fix detect-version-bumps.sh to detect version bumps in merge commits

## 0.4.3

### Patch Changes

- 5e30ea2: ## CI/CD Improvements

  - Add knip to build matrix in development, staging, and production workflows
  - Fix knip to use `bunx knip --no-progress` and limit checks to dependencies/devDependencies/unlisted/files
  - Fix detect-version-bumps.sh to properly detect version bumps in merge commits using HEAD^
  - Change changeset version commit message from `chore: version packages` to `ci: version bump`
  - Fix release branch to push directly to main instead of separate branch

## 0.4.2

### Patch Changes

- 8de8c9a: ## CI/CD Improvements

  - Add knip to build matrix in development, staging, and production workflows
  - Fix knip to use `bunx knip --no-progress` and limit checks to dependencies/devDependencies/unlisted/files
  - Fix detect-version-bumps.sh to properly detect version bumps in merge commits using HEAD^
  - Change changeset version commit message from `chore: version packages` to `ci: version bump`
  - Fix release branch to push directly to main instead of separate branch

## 0.4.1

### Patch Changes

- 15eec6d: ## CI/CD Improvements

  - Add knip to build matrix in development, staging, and production workflows
  - Fix knip to use `bunx knip --no-progress` and limit checks to dependencies/devDependencies/unlisted/files
  - Fix detect-version-bumps.sh to properly detect version bumps in merge commits using HEAD^
  - Change changeset version commit message from `chore: version packages` to `ci: version bump`
  - Fix release branch to push directly to main instead of separate branch

## 0.4.0

### Minor Changes

- 24cc06e: ## CI/CD Improvements

  ### Workflow Enhancements

  - Add knip to build matrix in development, staging, and production workflows
  - Change changeset version commit message from `chore: version packages` to `ci: version bump`
  - Configure releases branch to `releases/main` for cleaner release history

## 0.3.1

### Patch Changes

- 03f40af: Add Sentry metrics wrapper and console logging integration, implement unit of work pattern for transactional consistency, and add event-driven architecture for transaction operations"

## 0.3.0

### Minor Changes

- 7fd6170: Add Sentry error tracking and session replay to all apps

### Patch Changes

- Updated dependencies [7fd6170]
  - @repo/ui@0.3.0
  - @repo/common@0.3.0
  - @repo/sentry-config@0.2.0

## 0.2.0

### Patch Changes

- Updated dependencies
  - @repo/common@0.2.0
  - @repo/ui@0.2.0

## 0.1.9

### Patch Changes

- refactor: standardize readonly modifiers and type definitions across the codebase
  - @repo/ui@0.1.9
  - @repo/common@0.1.9

## 0.1.8

### Patch Changes

- 6455e75: fix(auth): resolve blank screen on /api/auth/reference and update dependencies

  ### Bug Fixes

  - **auth / core-service**: Disabled Better Auth's default reference page generation;
    manually mounted Auth OpenAPI reference using `@scalar/nestjs-api-reference` to resolve
    blank screen on `/api/auth/reference`
  - **core-service**: Resolved response truncation issue (16 KB limit) when running under Bun
    by mounting the scalar reference handler directly in `main.ts`

  ### Dependency Updates

  - `@biomejs/biome`: 2.4.9 → 2.4.10
  - `turbo`: 2.8.21 → 2.9.3
  - `next` / `@next/bundle-analyzer`: 16.2.1 → 16.2.2
  - `@tanstack/react-query`: → 5.96.0
  - `recharts`: → 3.8.1
  - `@playwright/test`: 1.58.2 → 1.59.0
  - `@nestjs/*` packages updated in `core-service`
  - `packages/auth` updated to latest

  ### UI Improvements (`@repo/ui`)

  - Improved type safety for `OhlcvChart` tooltip interaction in the investment app
  - Applied property ordering and style consistency across all UI components
    (accordion, alert-dialog, badge, button, calendar, chart, combobox, dialog,
    dropdown-menu, field, input-group, sidebar, tabs, and more)

  ### CI/CD Improvements

  - Parallelised `build`, `lint`, and `check-types` jobs using matrix strategy across
    all three pipelines (development, staging, production)
  - Added `.turbo` to GHA cache paths to persist Turbo task results between runs
  - Added commit SHA (`:sha8`) Docker image tags to all environments for traceability
  - Added `investment` to the Changesets `fixed[]` group for coordinated versioning
  - Added standard branch prefixes (`fix/**`, `bugfix/**`, `hotfix/**`, `chore/**`) to
    development pipeline triggers
  - Added `check-types` script to `core-service`
  - Improved snapshot versioning fallback logic with clearer comments

- Updated dependencies [6455e75]
  - @repo/common@0.1.8
  - @repo/ui@0.1.8

## 0.0.2

### Patch Changes

- Injected NEXT_PUBLIC environment variables as build arguments for Next.js Docker builds.
- Updated dependencies
  - @repo/ui@0.1.6
  - @repo/common@0.1.6

## 0.0.1

### Patch Changes

- f73e29d: Include investment app in CI/CD pipeline and Docker configuration.
- Updated dependencies [f73e29d]
  - @repo/ui@0.1.5
  - @repo/common@0.1.5
