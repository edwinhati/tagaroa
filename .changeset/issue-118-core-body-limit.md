---
"@servers/core": patch
---

ISSUE-118: Core refuses a request body over 10 MB with 413, and a sign-in request that does not declare its length with 411. The web proxy that enforced the limit before no longer sits in front of core.
