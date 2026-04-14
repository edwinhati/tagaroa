import * as Sentry from "@sentry/nextjs";

/**
 * Server-side instrumentation for Next.js
 * Handles server-side error tracking and request monitoring
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./instrumentation-server.js");
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./instrumentation-edge.js");
  }
}

export const onRequestError = Sentry.captureRequestError;
