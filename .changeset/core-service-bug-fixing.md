---
"core-service": patch
---

Refactor Zod schema definitions to replace `z.nativeEnum()` with `z.enum()`, update UUID validation to use `z.uuid()`, and adopt the new `z.flattenError(result.error)` standard.

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


