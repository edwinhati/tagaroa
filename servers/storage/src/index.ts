import { sql } from "bun";
import { Hono } from "hono";
import { logger as honoLogger } from "hono/logger";
import { config, isDevelopment } from "./config.js";
import { createLogger } from "./logger.js";
import { corsMiddleware, httpMiddleware } from "./middleware/index.js";
import { FileRepository } from "./repository/file-repository.js";
import { createFileRoutes } from "./routes/files.js";
import { createUploadRoutes } from "./routes/upload.js";
import { FileService } from "./service/file-service.js";
import { S3Service } from "./service/s3-service.js";

type AppContext = {
  requestId: string;
  logger: ReturnType<typeof createLogger>;
};

declare module "hono" {
  interface ContextVariableMap extends AppContext {}
}

const logger = createLogger("StorageServer");
const app = new Hono();

app.use("*", honoLogger(logger.honoSink));
app.use("*", httpMiddleware({ logger }));

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

app.get("/health", (c) => {
  return c.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    service: "storage-server",
    version: "1.0.0",
  });
});

const fileRepository = new FileRepository(sql, logger);
const s3Service = new S3Service(config.s3, logger);
const fileService = new FileService(fileRepository, s3Service, logger);

app.route("/upload", createUploadRoutes(fileService, logger));
app.route("/files", createFileRoutes(fileService, logger));

app.onError((err, c) => {
  const requestId = c.get("requestId");
  const context = `req:${requestId}`;
  const isDev = isDevelopment;

  logger.error(
    `Server error: ${err.message}`,
    isDev ? err.stack : undefined,
    context,
  );

  return c.json(
    {
      error: "Internal server error",
      message: isDev ? err.message : "An error occurred",
      requestId,
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
