---
"core-service": patch
"web": patch
"auth": patch
"admin": patch
"finance": patch
"@repo/ui": patch
"@repo/common": patch
"@repo/typescript-config": patch
---

feat(core): improve health module with Terminus best practices

- Refactored health endpoints for Kubernetes-compatible liveness and readiness probes
- Added custom Drizzle ORM health indicator with configurable resource thresholds
- Updated dependencies: turbo, @tabler/icons-react, react-resizable-panels, @thallesp/nestjs-better-auth
- Fixed CI: make GitHub release tag creation idempotent
- Fixed CI: bump patch version automatically for pre-release fallbacks
- Aligned git flow to environment promotion pattern (feature → develop → main)
