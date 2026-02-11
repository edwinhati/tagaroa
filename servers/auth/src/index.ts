import { serve } from "@hono/node-server";
import { config } from "./config";
import { createApp } from "./app";
import { CONSTANTS } from "./lib/constants";
import { initTelemetry } from "@repo/common/telemetry";

// Initialize OpenTelemetry first (before any other imports)
initTelemetry({
  serviceName: "auth-server",
  serviceVersion: "1.0.0",
  enabled: process.env.OTEL_ENABLED !== "false",
});

async function startServer() {
  const { app, logger } = createApp();

  serve({
    fetch: app.fetch,
    port: config.port,
  });

  logger.log(`Auth server listening on port ${config.port}`, "Bootstrap");
  logger.log(`Environment: ${config.nodeEnv}`, "Bootstrap");
}

let shutdownRequested = false;

const gracefulShutdown = (signal: string) => {
  if (shutdownRequested) return;
  shutdownRequested = true;

  console.log(`Received ${signal}, shutting down gracefully...`);

  setTimeout(() => {
    console.log("Shutdown complete");
    process.exit(0);
  }, CONSTANTS.SERVER.SHUTDOWN_TIMEOUT_MS);
};

process.on("SIGINT", () => gracefulShutdown("SIGINT"));
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));

startServer().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});
