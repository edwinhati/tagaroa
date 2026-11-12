/**
 * The origins every workspace app talks to, read once from the build's env.
 * Only the domain front ends live behind the microfrontends proxy; the door and
 * `apps/admin` stand on their own, so a link to them is a document navigation.
 */

/** The core service, which also answers Better Auth under `/api/auth`. */
export const CORE_URL =
  import.meta.env.VITE_AUTH_BASE_URL ?? "http://localhost:8080";
export const AUTH_URL =
  import.meta.env.VITE_AUTH_URL ?? "http://localhost:3001";
export const WORKSPACE_URL =
  import.meta.env.VITE_WORKSPACE_URL ?? "http://localhost:3000";
export const ADMIN_URL =
  import.meta.env.VITE_ADMIN_URL ?? "http://localhost:3003";
