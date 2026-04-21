# core-service

## 0.4.7

### Patch Changes

- a8212fd: Refactor Zod schema definitions to replace `z.nativeEnum()` with `z.enum()`, update UUID validation to use `z.uuid()`, and adopt the new `z.flattenError(result.error)` standard.

  Fixed `ConcurrentModificationException` in Account balance updates:

  - Removed redundant version increment in `Account` domain entity. The repository now handles atomic version increments in the database, preventing false-positive optimistic locking conflicts.
  - Fixed a bug in `AccountBalanceEventHandler` where account-specific locks were never cleared from memory due to an incorrect promise comparison in the cleanup logic.

  Fixed transaction validation and budget item management:

  - Updated `CreateTransactionDto` and `UpdateTransactionDto` to handle empty strings for `budget_item_id` by converting them to `null` via `z.preprocess`.
  - Enhanced `UpdateTransactionUseCase` to allow clearing the budget item by passing `null`, while treating `undefined` as "no change".
  - Removed redundant `normalizeBudgetItemId` utility as validation is now handled at the DTO layer.

  Security improvements in `@repo/auth`:

  - Added `freshAge: 1 hour` to session configuration to enforce re-authentication for sensitive operations (like account deletion or critical financial changes) while maintaining a 7-day session for general use.

  Fixed frontend account balance and dashboard stale data:

  - Updated transaction mutation hooks in `packages/common` to invalidate `accounts`, `budgets`, and all dashboard-related query keys (`dashboard-summary`, `account-aggregations`, etc.) when a transaction is modified. This ensures the UI reflects balance and progress changes immediately without a manual refresh.
    Update transaction and account mutation hooks to consistently invalidate dashboard aggregations.

  Fixed GitHub Actions workflows:

  - Enabled `build` and `test` jobs to run on `pull_request` events in both `Staging` and `Development` pipelines. Previously, these jobs only ran on `push` events, causing CI to skip for Pull Requests.

## 0.4.6

### Patch Changes

- 1acbdd8: **Core Service**

  - **Sentry Integration:** Refactored exception filtering to only capture explicit HTTP `500` Server Errors, eliminating noise from domain exceptions (4xx) generated during normal application workflows.
  - **Database Serialization:** Reinforced JSONB database arrays with Drizzle's `.$type<Record<string, unknown>>()` implementation across `account`, `transaction`, `liability`, `instrument`, and `portfolio-snapshot` schemas in order to resolve `JSON Parse error: Unrecognized token ' '` instances caused by driver mappings.
  - **S3 Connectivity:** Repaired AWS Signature V4 serialization to properly terminate empty elements in Canonical Requests, resolving `403 Forbidden` verification errors.
  - **Dependencies:** Bumped `@sentry/nestjs`, `better-auth`, and `@scalar/nestjs-api-reference` packages.

  **UI Layer**

  - Updated `shadcn` to resolve missing definitions.

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

## 0.2.0

### Patch Changes

- Updated dependencies
  - @repo/auth@0.1.0

## 0.1.9

### Patch Changes

- refactor: standardize readonly modifiers and type definitions across the codebase

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
  - @repo/auth@0.0.1

## 0.1.7

### Patch Changes

- 3789c81: feat(core): improve health module with Terminus best practices

  - Refactored health endpoints for Kubernetes-compatible liveness and readiness probes
  - Added custom Drizzle ORM health indicator with configurable resource thresholds
  - Updated dependencies: turbo, @tabler/icons-react, react-resizable-panels, @thallesp/nestjs-better-auth
  - Fixed CI: make GitHub release tag creation idempotent
  - Fixed CI: bump patch version automatically for pre-release fallbacks
  - Aligned git flow to environment promotion pattern (feature → develop → main)

## 0.1.6

### Patch Changes

- Injected NEXT_PUBLIC environment variables as build arguments for Next.js Docker builds.

## 0.1.5

### Patch Changes

- f73e29d: Include investment app in CI/CD pipeline and Docker configuration.

## 0.1.4

### Patch Changes

- Fix Docker build failures and optimize CI build context.

## 0.1.3

### Patch Changes

- 771d89e: CI pipeline restructure and Docker build fixes.

## 0.1.2

### Patch Changes

- 6c144ee: Fix CI/CD release pipeline to properly create tags and GitHub releases for private packages.

## 0.1.1

### Patch Changes

- 3eadd39: Fix CI release pipeline: switch from changeset tag to changeset publish to enable automated deploy.

## 0.1.0

### Minor Changes

- bc4e434: Initial release of the Tagaroa platform including finance dashboard, investment dashboard, admin panel, auth flows, and core API service.
