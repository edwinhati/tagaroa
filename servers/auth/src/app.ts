import { Hono } from "hono";
import { logger as honoLogger } from "hono/logger";
import { createLogger } from "./logger";
import { corsMiddleware, httpMiddleware } from "./middleware";
import { handleAuth } from "./routes";

export function createApp() {
  const app = new Hono();
  const logger = createLogger("AuthServer");

  app.use("*", honoLogger(logger.honoSink));
  app.use("*", httpMiddleware({ logger }));

  app.use("/api/auth/*", corsMiddleware);

  app.on(["POST", "GET"], "/api/auth/*", handleAuth);

  return { app, logger };
}
