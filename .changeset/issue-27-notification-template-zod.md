---
"@servers/core": patch
---

ISSUE-27: Notification template create and edit validate their bodies with Zod. A malformed request is a 400 that lists each field's error under `details`, and a non-list `variables` or `secrets`, or a non-text `subject`, is now refused instead of ignored.
