# investment

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
