/**
 * The origins every workspace app talks to.
 *
 * Deployed, the apps are served from `auth.`, `app.` and `admin.<base>` and core
 * from `<base>` (auth.dev.tagaroa.cc → dev.tagaroa.cc), so each URL is worked out
 * from the address the app was loaded from and one image runs in every
 * environment. A VITE_ value wins (local dev, e2e builds); with neither, the
 * local dev ports.
 *
 * Only the domain front ends live behind the microfrontends proxy; the door and
 * `apps/admin` stand on their own, so a link to them is a document navigation.
 */
const base =
  !import.meta.env.DEV && typeof window !== "undefined"
    ? /^(?:auth|app|admin)\.(.+)$/.exec(window.location.host ?? "")?.[1]
    : undefined;

const deployed = (prefix: string): string | undefined =>
  base === undefined
    ? undefined
    : `${window.location.protocol}//${prefix}${base}`;

/** True when the URLs below were worked out from a deployed host. */
export const IS_DEPLOYED = base !== undefined;

/** The core service, which also answers Better Auth under `/api/auth`. */
export const CORE_URL =
  import.meta.env.VITE_AUTH_BASE_URL ?? deployed("") ?? "http://localhost:8080";
export const AUTH_URL =
  import.meta.env.VITE_AUTH_URL ?? deployed("auth.") ?? "http://localhost:3001";
export const WORKSPACE_URL =
  import.meta.env.VITE_WORKSPACE_URL ??
  deployed("app.") ??
  "http://localhost:3000";
export const ADMIN_URL =
  import.meta.env.VITE_ADMIN_URL ??
  deployed("admin.") ??
  "http://localhost:3003";
