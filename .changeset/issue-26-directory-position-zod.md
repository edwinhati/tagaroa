---
"@servers/core": patch
---

ISSUE-26: `PUT /api/directory/positions/...` now validates its body with Zod. A failure is a 400 with `message` plus `details: [{ field, message }]`. A non-string `managerUserId` is now rejected instead of clearing the manager. A blank title for a person who does not exist returns 400 instead of 404.
