import * as Sentry from "@sentry/nextjs";
import { getSentryConfig, validateSentryConfig } from "../config";

export function initSentryClient(): void {
  const config = getSentryConfig();

  if (!config.enabled) {
    return;
  }

  const errors = validateSentryConfig(config);
  if (errors.length > 0) {
    console.warn("[Sentry Client] Configuration warnings:", errors);
  }

  Sentry.init({
    dsn: config.dsn,
    environment: config.environment,
    tracesSampleRate: config.tracesSampleRate,
    debug: config.debug,
    sendDefaultPii: true,
    enableLogs: true,
    integrations: [
      Sentry.consoleLoggingIntegration({ levels: ["log", "warn", "error"] }),
    ],
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1,
    beforeSend(event) {
      if (config.debug) {
        console.debug("[Sentry Client] Sending event:", event.event_id);
      }
      return event;
    },
  });
}

initSentryClient();
