---
"@servers/core": patch
---

ISSUE-131: The core-service image no longer ships TypeScript's native `tsc` (a peer dependency core never loads), which clears the `golang.org/x/text` finding. The remaining glibc findings have no fix in any `oven/bun` base and are explained in `docs/ops/core-image-findings.md`.
