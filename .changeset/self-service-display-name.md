---
"@apps/workspace": patch
"@apps/admin": patch
"@servers/core": patch
---

ISSUE-51: People can change their own display name in Account settings. Email, role and the personal address stay admin-managed: the self-service update now refuses every other field, and each change is recorded in the identity activity trail.
