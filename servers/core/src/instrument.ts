import * as Sentry from "@sentry/nestjs";

const isEnabled = process.env.SENTRY_ENABLED === "true";
const dsn = process.env.SENTRY_DSN;

if (isEnabled && dsn) {
  Sentry.init({
    dsn,
    environment:
      process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ||
      process.env.SENTRY_ENVIRONMENT ||
      process.env.NODE_ENV ||
      "development",

    enableLogs: true,
    integrations: [
      Sentry.consoleLoggingIntegration({ levels: ["log", "warn", "error"] }),
    ],
    tracesSampleRate: Number.parseFloat(
      process.env.SENTRY_TRACES_SAMPLE_RATE || "1.0",
    ),
    sendDefaultPii: true,

    beforeSend(event) {
      if (process.env.NODE_ENV === "development") {
        console.log("[Sentry] Event captured:", event.event_id);
      }
      return event;
    },
  });
} else {
  console.log(
    "[Sentry] Disabled - set SENTRY_ENABLED=true and SENTRY_DSN to enable",
  );
}
