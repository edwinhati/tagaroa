---
"@apps/auth": patch
"@apps/admin": patch
"@apps/workspace": patch
"@domains/engineering": patch
"@repo/shell": patch
---

ISSUE-118: Each app ships as its own image, on its own version. Deployed, an app works out its addresses from the host it is served from (`auth.`, `app.` and `admin.<base>`, the API at `<base>`), so the same image runs in every environment. Locally, the `VITE_` values still apply.
