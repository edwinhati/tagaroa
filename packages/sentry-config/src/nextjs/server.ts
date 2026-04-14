import * as Sentry from "@sentry/nextjs";
import { getSentryConfig, validateSentryConfig } from "../config";

/**
 * Initialize Sentry for server-side (Node.js runtime)
 * Import this in your sentry.server.config.ts
 */
export function initSentryServer(): void {
  const config = getSentryConfig();

  if (!config.enabled) {
    if (config.debug) {
      console.debug("[Sentry Server] Disabled - skipping initialization");
    }
    return;
  }

  const errors = validateSentryConfig(config);
  if (errors.length > 0) {
    console.warn("[Sentry Server] Configuration warnings:", errors);
  }

  // Detect Bun runtime - disable features that use node:inspector
  // https://github.com/oven-sh/bun/issues/2445
  const isBun = process.versions.bun !== undefined;

  if (isBun && config.debug) {
    console.debug(
      "[Sentry Server] Bun detected - disabling node:inspector features",
    );
  }

  Sentry.init({
    dsn: config.dsn,
    environment: config.environment,
    tracesSampleRate: config.tracesSampleRate,
    debug: config.debug,
    sendDefaultPii: true,
    // includeLocalVariables uses node:inspector which isn't implemented in Bun
    includeLocalVariables: !isBun,
    // Remove LocalVariablesAsync integration in Bun (it uses node:inspector)
    integrations: isBun
      ? (integrations) =>
          integrations.filter(
            (integration) => integration.name !== "LocalVariablesAsync",
          )
      : undefined,

    beforeSend(event) {
      if (config.debug) {
        console.debug("[Sentry Server] Sending event:", event.event_id);
      }
      return event;
    },
  });
}

// Auto-initialize when this module is imported
initSentryServer();
