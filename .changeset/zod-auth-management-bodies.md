---
"@servers/core": patch
---

ISSUE-25: Auth-management requests (factor recovery request and approval, offboarding, and creating subsidiaries, teams and members) now validate their bodies with Zod. Valid requests are unchanged; an invalid body returns the standard 400 with `message` and `details: [{ field, message }]`.
