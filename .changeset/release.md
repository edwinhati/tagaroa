---
"core-service": patch
---

Fixed account balance corruption on transaction update:
- Updated `AccountBalanceEventHandler` to only adjust balances when relevant fields (`accountId`, `amount`, or `type`) change. Previously, the handler would always reverse the previous transaction's effect but only re-apply it if these fields changed, leading to incorrect balance deductions when editing unrelated fields like descriptions or dates.


