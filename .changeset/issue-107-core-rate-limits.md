---
"@servers/core": patch
---

ISSUE-107: Core's own routes are rate-limited per client: 600 requests a minute, and 120 for the HR and message-provider webhooks. Past that a client gets a 429 with "Too many requests. Wait a minute and try again." Better Auth's routes keep their own limits, and health checks have none.

A provider retrying a delivery receipt no longer changes anything. A message keeps the time its outcome first arrived, and a retried bounce no longer blocks an address an admin has cleared.
