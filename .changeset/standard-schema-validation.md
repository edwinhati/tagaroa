---
"@servers/core": patch
---

Validate request bodies and queries with Nest's built-in Standard Schema pipe instead of a hand-written one. Error responses are unchanged; `__proto__`, `prototype` and `constructor` keys are now stripped from a request before it is parsed.
