---
"@apps/admin": patch
"@apps/auth": patch
"@apps/workspace": patch
"@domains/engineering": patch
"@repo/contracts": minor
"@repo/shell": minor
"@repo/ui": minor
---

ISSUE-103: Every app now builds and routes through `@repo/shell` (`@repo/shell/vite`, `@repo/shell/router`), and admin's paged tables share one URL state.

- Admin's people list, delivery log and suppressions list read and write their filters the same way. The search box no longer drops a trailing space or resets while you type, keeps up with Back and Clear, and a stale or hand-edited link (an unknown sort, filter or page) opens the page instead of an error.
- Changing the page size keeps the rows you were looking at in view on the people list too.
- The suppression list offers every reason as a filter, not only those already present.
- The people row menu says "Revoke all sessions" and the person page's menu says "Impersonate", matching each other.
- Every app cancels its in-flight reads when the page is left, as the back office already did.
