---
"@servers/core": patch
---

ISSUE-135: The HR sync can read a Frappe site behind Pangolin: set `FRAPPE_ACCESS_TOKEN` to a Pangolin share-link token (`<id>.<token>`) and core sends it with every Frappe request.
