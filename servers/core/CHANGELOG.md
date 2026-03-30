# core-service

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
