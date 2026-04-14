import * as Sentry from "@sentry/nextjs";
import { getSentryConfig, validateSentryConfig } from "../config.js";

/**
 * Initialize Sentry for edge runtime
 * Import this in your sentry.edge.config.ts
 */
export function initSentryEdge(): void {
  const config = getSentryConfig();

  if (!config.enabled) {
    if (config.debug) {
      console.debug("[Sentry Edge] Disabled - skipping initialization");
    }
    return;
  }

  const errors = validateSentryConfig(config);
  if (errors.length > 0) {
    console.warn("[Sentry Edge] Configuration warnings:", errors);
  }

  Sentry.init({
    dsn: config.dsn,
    environment: config.environment,
    tracesSampleRate: config.tracesSampleRate,
    debug: config.debug,
    sendDefaultPii: true,

    beforeSend(event) {
      if (config.debug) {
        console.debug("[Sentry Edge] Sending event:", event.event_id);
      }
      return event;
    },
  });
}

// Auto-initialize when this module is imported
initSentryEdge();
