---
"core-service": patch
---

Refactor Zod schema definitions to replace `z.nativeEnum()` with `z.enum()`, update UUID validation to use `z.uuid()`, and adopt the new `z.flattenError(result.error)` standard. These changes resolve multiple deprecation warnings and TypeScript type inference bugs resulting from the migration to Zod v4.

Fix Zod v4 deprecation warnings:
- Replaced `z.nativeEnum()` with `z.enum()` for domain value objects
- Replaced `z.string().uuid()` with `z.uuid()` in DTOs
- Updated `ZodValidationPipe` to use Zod v4 `z.flattenError` and improved error typing

Fixed `ConcurrentModificationException` in overlapping asynchronous Account balance updates:
- Added optimistic concurrency retry loop with a backoff/jitter inside `AccountBalanceEventHandler.adjustBalance()` to automatically recover from rapid, overlapping `transaction.created` events.
- Fixed account balances not updating by moving `eventEmitter.emit` calls outside `unitOfWork` transactions in `CreateTransactionUseCase`, `UpdateTransactionUseCase`, and `DeleteTransactionUseCase`, ensuring event handlers read the committed account row version.
