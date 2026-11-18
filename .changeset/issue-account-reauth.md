---
"@apps/admin": patch
---

ISSUE-136: Issuing an account with a privileged role from a sign-in older than 15 minutes now goes to "Confirm it’s you" and back, like every other sensitive admin action, instead of leaving "Sign in again before granting privileged access." in the dialog with no way to do it.
