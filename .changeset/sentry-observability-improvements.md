---
"finance": patch
"auth": patch
"admin": patch
"investment": patch
"web": patch
"core-service": patch
---

## Sentry Observability Improvements

### Bug Fixes

- **Fixed Sentry SDK disconnected in all Next.js apps** — `getEnvVar()` in `@repo/sentry-config` used dynamic bracket access (`process.env[name]`) which Next.js/webpack cannot statically inline in the browser. Replaced with an explicit static map so all `NEXT_PUBLIC_SENTRY_*` variables are correctly inlined at build time, allowing `Sentry.init()` to run on the client.

- **Fixed `onRouterTransitionStart` warning** — Added the required `export const onRouterTransitionStart = Sentry.captureRouterTransitionStart` to all `instrumentation-client.ts` files, sourced via `@repo/sentry-config/nextjs/client` to keep `@sentry/nextjs` as a shared internal dependency.

### Features

- **Sentry metrics support** — Updated `SentryTestConsole` to use the correct `@sentry/nextjs` v10 metrics API (`Sentry.metrics.count`, `Sentry.metrics.distribution`, `Sentry.metrics.gauge`) so metrics are sent to Sentry's ingestion endpoint and appear in Explore → Metrics.

- **Sentry logger support in `core-service`** — Added `consoleLoggingIntegration` to `instrument.ts` so `console.log/warn/error` calls are forwarded to Sentry Logs. Added dedicated debug endpoints:
  - `GET /api/debug/sentry-metrics` — emits count, gauge, and distribution metrics
  - `GET /api/debug/sentry-logs` — emits logs at all severity levels via `Sentry.logger.*` and console

- **`/sentry-test` page bypasses auth** — The Sentry test console page is now accessible without authentication in development. Each app's `sentry-test/` directory has a passthrough `layout.tsx` that opts the page out of the root sidebar `template.tsx`, so the console renders as a standalone full-page UI.
