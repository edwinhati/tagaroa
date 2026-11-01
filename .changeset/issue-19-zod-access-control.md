---
"@servers/core": patch
---

ISSUE-19: Access-control requests are now checked against a schema. A body that is not a JSON object returns 400 "Request body must be a JSON object." with field `details`; before, it was read as empty, so `PATCH /access-control/assignments/:id` with no body silently cleared the expiry. Valid requests behave as before.
