---
"@servers/core": patch
---

ISSUE-63: An impersonated session can no longer record access reviews, change access-control roles, grants or break-glass, or write through Better Auth's admin and organization endpoints. Operators must use their own MFA-protected account; reads and stopping impersonation still work.
