---
"core-service": patch
---

**Core Service**

- **Sentry Integration:** Refactored exception filtering to only capture explicit HTTP `500` Server Errors, eliminating noise from domain exceptions (4xx) generated during normal application workflows. 
- **Database Serialization:** Reinforced JSONB database arrays with Drizzle's `.$type<Record<string, unknown>>()` implementation across `account`, `transaction`, `liability`, `instrument`, and `portfolio-snapshot` schemas in order to resolve `JSON Parse error: Unrecognized token ' '` instances caused by driver mappings.
- **S3 Connectivity:** Repaired AWS Signature V4 serialization to properly terminate empty elements in Canonical Requests, resolving `403 Forbidden` verification errors.
- **Dependencies:** Bumped `@sentry/nestjs`, `better-auth`, and `@scalar/nestjs-api-reference` packages.

**UI Layer**

- Updated `shadcn` to resolve missing definitions.
