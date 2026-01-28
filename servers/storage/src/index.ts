import { sql } from "bun";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { config } from "./config";
import { FileRepository } from "./repository/file-repository";
import { createFileRoutes } from "./routes/files";
import { createUploadRoutes } from "./routes/upload";
import { FileService } from "./service/file-service";
import { S3Service } from "./service/s3-service";

const app = new Hono();

// CORS middleware
app.use(
  "*",
  cors({
    origin: config.trustedOrigins,
    credentials: true,
  }),
);

// Health check
app.get("/health", (c) => {
  return c.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    service: "storage-server",
  });
});

// Initialize services
const fileRepository = new FileRepository(sql);
const s3Service = new S3Service(config.s3);
const fileService = new FileService(fileRepository, s3Service);

// Mount routes
app.route("/upload", createUploadRoutes(fileService));
app.route("/files", createFileRoutes(fileService));

// Error handler
app.onError((err, c) => {
  console.error("Server error:", err);
  return c.json(
    {
      error: "Internal server error",
      message: config.isDevelopment ? err.message : "An error occurred",
    },
    500,
  );
});

// Start server
console.log(`🚀 Storage server running on port ${config.port}`);
console.log(`📦 S3 Bucket: ${config.s3.bucket}`);
console.log(`🌍 Environment: ${config.env}`);

export default {
  port: config.port,
  fetch: app.fetch,
};
