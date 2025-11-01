import { Hono } from "hono";
import { logger as honoLogger } from "hono/logger";
import { createLogger, httpMiddleware } from "./logger";
import { corsMiddleware } from "./middleware";
import { handleAuth } from "./routes";

export function createApp() {
  const app = new Hono();
  const logger = createLogger("AuthServer");

  // Global middleware
  app.use("*", honoLogger(logger.honoSink));
  app.use("*", httpMiddleware(logger));

  // CORS for auth routes
  app.use("/api/auth/*", corsMiddleware);

  // Auth routes
  app.on(["POST", "GET"], "/api/auth/*", handleAuth);

  return { app, logger };
}
