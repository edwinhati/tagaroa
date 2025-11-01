import { createApp } from "./app";
import { config } from "./config";
import { serve } from "@hono/node-server";

async function startServer() {
  const { app, logger } = createApp();

  serve({
    fetch: app.fetch,
    port: config.port,
  });

  logger.log(`Auth server listening on port ${config.port}`, "Bootstrap");
  logger.log(`Environment: ${config.nodeEnv}`, "Bootstrap");
}

// Handle graceful shutdown
process.on("SIGINT", () => {
  console.log("Received SIGINT, shutting down gracefully");
  process.exit(0);
});

process.on("SIGTERM", () => {
  console.log("Received SIGTERM, shutting down gracefully");
  process.exit(0);
});

startServer().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});
