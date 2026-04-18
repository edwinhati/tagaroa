---
"core-service": patch
---

Refactor Zod schema definitions to replace `z.nativeEnum()` with `z.enum()`, update UUID validation to use `z.uuid()`, and adopt the new `z.flattenError(result.error)` standard. These changes resolve multiple deprecation warnings and TypeScript type inference bugs resulting from the migration to Zod v4.
