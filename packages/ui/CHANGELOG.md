# @repo/ui

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
