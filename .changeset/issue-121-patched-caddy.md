---
"@apps/auth": patch
"@apps/admin": patch
"@apps/workspace": patch
"@domains/engineering": patch
---

ISSUE-121: Each app is served by Caddy rebuilt with patched dependencies on an empty base image, which removes its critical and fixable high vulnerabilities.
