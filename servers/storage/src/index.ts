import { sql } from "bun";
import { Hono } from "hono";
import { logger as honoLogger } from "hono/logger";
import { config, isDevelopment } from "./config.js";
import { createOIDCClient } from "./lib/oidc-client.js";
import { createLogger } from "./logger.js";
import {
  corsMiddleware,
  createAuthMiddleware,
  httpMiddleware,
} from "./middleware/index.js";
import { FileRepository } from "./repository/file-repository.js";
import { createFileRoutes } from "./routes/files.js";
import { createUploadRoutes } from "./routes/upload.js";
import { FileService } from "./service/file-service.js";
import { S3Service } from "./service/s3-service.js";
import { initTelemetry } from "@repo/common";
import {
  createMetrics,
  measureRequest,
  getMetricsText,
  getMetricsContentType,
} from "@repo/common";
import { traceMiddleware } from "@repo/common";

// Initialize OpenTelemetry first (before any other imports)
initTelemetry({
  serviceName: "storage-server",
  serviceVersion: "1.0.0",
  enabled: process.env.OTEL_ENABLED !== "false",
});

const SERVICE_NAME = "storage-server";
const SERVICE_VERSION = "1.0.0";

// Create metrics registry
const metrics = createMetrics({ serviceName: SERVICE_NAME });

type AppContext = {
  requestId: string;
  logger: ReturnType<typeof createLogger>; // Use ReturnType to get the type from the logger factory
  userId: string;
  traceId?: string;
};

declare module "hono" {
  interface ContextVariableMap extends AppContext {}
}

const logger = createLogger("StorageServer");
const app = new Hono();

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

// Initialize OIDC client
const oidcClient = await createOIDCClient(config.oidc, logger);
const authMiddleware = createAuthMiddleware({ oidcClient, logger });

// CORS middleware for protected routes
app.use(
  "/upload/*",
  corsMiddleware({
    origin: config.cors.origin,
    credentials: config.cors.credentials ?? true,
  }),
);
app.use(
  "/files/*",
  corsMiddleware({
    origin: config.cors.origin,
    credentials: config.cors.credentials ?? true,
  }),
);

// Auth middleware for protected routes
app.use("/upload/*", authMiddleware);
app.use("/files/*", authMiddleware);

// Health check - basic liveness probe
app.get("/health", (c) => {
  return c.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    service: SERVICE_NAME,
    version: SERVICE_VERSION,
  });
});

// Initialize services early so we can use them in readiness checks
const fileRepository = new FileRepository(sql, logger);
const s3Service = new S3Service(config.s3, logger);
const fileService = new FileService(fileRepository, s3Service, logger);

// Readiness check - verifies dependencies are available
app.get("/ready", async (c) => {
  const checks: Record<string, boolean> = {};

  // Check database connectivity
  try {
    await sql`SELECT 1`;
    checks.database = true;
  } catch {
    checks.database = false;
  }

  // Check S3 connectivity by checking if a test key exists (lightweight operation)
  try {
    await s3Service.exists("__health_check__");
    checks.s3 = true;
  } catch {
    checks.s3 = false;
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

app.route("/upload", createUploadRoutes(fileService, logger));
app.route("/files", createFileRoutes(fileService, logger));

app.onError((err, c) => {
  const requestId = c.get("requestId") || "unknown";
  const traceId = c.get("traceId");
  const context = `req:${requestId}${traceId ? ` trace:${traceId}` : ""}`;
  const isDev = isDevelopment;

  logger.error(
    `Server error: ${err.message}`,
    isDev ? err.stack : undefined,
    context,
  );

  // Unified error response format
  return c.json(
    {
      error: {
        code: "INTERNAL_ERROR",
        message: isDev ? err.message : "An internal error occurred",
        details: isDev ? { stack: err.stack } : undefined,
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

logger.info(`🚀 Storage server starting on port ${config.port}`);
logger.info(`📦 S3 Bucket: ${config.s3.bucket}`);
logger.info(`🌍 Environment: ${config.env}`);

export default {
  port: config.port,
  fetch: app.fetch,
};
