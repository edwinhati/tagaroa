import { Hono } from "hono";
import { logger as honoLogger } from "hono/logger";
import { sql } from "drizzle-orm";
import { db } from "./db";
import { createLogger } from "./logger";
import { corsMiddleware, httpMiddleware } from "./middleware";
import { handleAuth } from "./routes";
import {
  createMetrics,
  measureRequest,
  getMetricsText,
  getMetricsContentType,
} from "@repo/common/metrics";
import { traceMiddleware } from "@repo/common/middleware/trace";

const SERVICE_NAME = "auth-server";
const SERVICE_VERSION = "1.0.0";

// Create metrics registry
const metrics = createMetrics({ serviceName: SERVICE_NAME });

export function createApp() {
  const app = new Hono();
  const logger = createLogger("AuthServer");

  app.use("*", honoLogger(logger.honoSink));
  app.use("*", httpMiddleware({ logger }));
  app.use("*", traceMiddleware);

  // Metrics middleware - measures request duration and counts
  app.use("*", async (c, next) => {
    const start = Date.now();
    await next();
    const duration = Date.now() - start;
    measureRequest(metrics, c.req.method, c.req.path, c.res.status, duration);
  });

  // Health check - basic liveness probe
  app.get("/health", (c) => {
    return c.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      service: SERVICE_NAME,
      version: SERVICE_VERSION,
    });
  });

  // Readiness check - verifies dependencies are available
  app.get("/ready", async (c) => {
    const checks: Record<string, boolean> = {};

    // Check database connectivity
    try {
      await db.execute(sql`SELECT 1`);
      checks.database = true;
    } catch {
      checks.database = false;
    }

    const allHealthy = Object.values(checks).every(Boolean);

    return c.json(
      {
        status: allHealthy ? "ready" : "degraded",
        checks,
        timestamp: new Date().toISOString(),
        service: SERVICE_NAME,
        version: SERVICE_VERSION,
      },
      allHealthy ? 200 : 503,
    );
  });

  // Prometheus metrics endpoint
  app.get("/metrics", async (c) => {
    const metricsText = await getMetricsText(metrics);
    return c.text(metricsText, 200, {
      "Content-Type": getMetricsContentType(metrics),
    });
  });

  app.use("/api/auth/*", corsMiddleware);

  app.on(["POST", "GET"], "/api/auth/*", handleAuth);

  // Error handler with trace context
  app.onError((err, c) => {
    const requestId = c.get("requestId") || "unknown";
    const traceId = c.get("traceId");

    logger.error(
      `Server error: ${err.message}`,
      err.stack,
      `req:${requestId}${traceId ? ` trace:${traceId}` : ""}`,
    );

    // Unified error response format
    return c.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message:
            process.env.NODE_ENV === "development"
              ? err.message
              : "An internal error occurred",
          details:
            process.env.NODE_ENV === "development"
              ? { stack: err.stack }
              : undefined,
        },
        meta: {
          requestId,
          traceId,
          timestamp: new Date().toISOString(),
          service: SERVICE_NAME,
        },
      },
      500,
    );
  });

  return { app, logger };
}
