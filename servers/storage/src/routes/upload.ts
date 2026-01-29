import { Hono } from "hono";
import { getRequestId } from "../middleware/http.js";
import type { LoggerPort } from "../ports/logger.port.js";
import type { FileService } from "../service/file-service";

interface UploadBody {
  originalName: string;
  contentType?: string;
  expiresIn?: number;
  prefix?: string;
}

export const createUploadRoutes = (
  fileService: FileService,
  logger: LoggerPort,
) => {
  const app = new Hono();

  app.post("/", async (c) => {
    const requestId = getRequestId(c);
    const ctx = `req:${requestId}`;

    try {
      const formData = await c.req.formData();
      const file = formData.get("file");

      if (!file || !(file instanceof File)) {
        return c.json(
          {
            error: "No file provided",
            message: "Please provide a file in the 'file' field",
          },
          400,
        );
      }

      const prefixValue = formData.get("prefix");
      const prefix =
        prefixValue instanceof File ? undefined : prefixValue?.toString();

      const result = await fileService.uploadFile({
        file,
        originalName: file.name,
        contentType: file.type,
        prefix,
      });

      logger.info(
        `Uploaded file - id:${result.file.id} name:${file.name} size:${result.file.size}`,
        ctx,
      );

      return c.json(
        {
          success: true,
          data: {
            id: result.file.id,
            url: result.url,
            key: result.file.key,
            size: result.file.size,
            contentType: result.file.content_type,
            originalName: result.file.original_name,
            createdAt: result.file.created_at,
          },
        },
        201,
      );
    } catch (error) {
      const err = error as Error;
      logger.error(`Upload failed - ${err.message}`, err.stack, ctx);
      return c.json(
        {
          error: "Upload failed",
          message: err.message,
        },
        500,
      );
    }
  });

  app.post("/presigned", async (c) => {
    const requestId = getRequestId(c);
    const ctx = `req:${requestId}`;

    try {
      const body = await c.req.json<UploadBody>();
      const { originalName, contentType, expiresIn, prefix } = body;

      if (!originalName) {
        return c.json(
          {
            error: "Missing originalName",
            message: "originalName is required",
          },
          400,
        );
      }

      const result = await fileService.getUploadUrl({
        originalName,
        contentType,
        expiresIn,
        prefix,
      });

      logger.info(`Generated presigned upload URL - name:${originalName}`, ctx);

      return c.json({
        success: true,
        data: {
          url: result.url,
          key: result.key,
          expiresIn: expiresIn || 3600,
        },
      });
    } catch (error) {
      const err = error as Error;
      logger.error(`Presigned URL failed - ${err.message}`, err.stack, ctx);
      return c.json(
        {
          error: "Failed to generate presigned URL",
          message: err.message,
        },
        500,
      );
    }
  });

  app.post("/batch", async (c) => {
    const requestId = getRequestId(c);
    const ctx = `req:${requestId}`;

    try {
      const formData = await c.req.formData();
      const files = formData.getAll("files");

      if (!files || files.length === 0) {
        return c.json(
          {
            error: "No files provided",
            message: "Please provide files in the 'files' field",
          },
          400,
        );
      }

      const prefixValue = formData.get("prefix");
      const prefix =
        prefixValue instanceof File ? undefined : prefixValue?.toString();

      const results = await Promise.all(
        files.map(async (file) => {
          if (!(file instanceof File)) {
            throw new TypeError("Invalid file in batch");
          }

          return await fileService.uploadFile({
            file,
            originalName: file.name,
            contentType: file.type,
            prefix,
          });
        }),
      );

      logger.info(
        `Batch upload completed - count:${results.length} files`,
        ctx,
      );

      return c.json(
        {
          success: true,
          data: results.map((result) => ({
            id: result.file.id,
            url: result.url,
            key: result.file.key,
            size: result.file.size,
            contentType: result.file.content_type,
            originalName: result.file.original_name,
            createdAt: result.file.created_at,
          })),
        },
        201,
      );
    } catch (error) {
      const err = error as Error;
      logger.error(`Batch upload failed - ${err.message}`, err.stack, ctx);
      return c.json(
        {
          error: "Batch upload failed",
          message: err.message,
        },
        500,
      );
    }
  });

  return app;
};
