import { Hono } from "hono";
import { getLogger, getRequestId } from "../middleware/http.js";
import type { LoggerPort } from "../ports/logger.port.js";
import type { FileService } from "../service/file-service";

interface ListFilesQuery {
  search?: string;
  contentType?: string;
  limit: number;
  offset: number;
  orderBy: string;
}

export const createFileRoutes = (
  fileService: FileService,
  logger: LoggerPort,
) => {
  const app = new Hono();

  app.get("/", async (c) => {
    const startTime = Date.now();
    const requestId = getRequestId(c);
    const ctx = `req:${requestId}`;

    try {
      const search = c.req.query("search");
      const contentType = c.req.query("contentType");
      const limit = Number.parseInt(c.req.query("limit") || "50", 10);
      const offset = Number.parseInt(c.req.query("offset") || "0", 10);
      const orderBy = c.req.query("orderBy") || "created_at DESC";

      const query: ListFilesQuery = {
        search,
        contentType,
        limit,
        offset,
        orderBy,
      };

      const result = await fileService.listFiles(query);

      logger.info(
        `Listed files - limit:${limit} offset:${offset} total:${result.total}`,
        ctx,
      );

      return c.json({
        success: true,
        data: result.files,
        pagination: {
          total: result.total,
          limit,
          offset,
          hasMore: offset + limit < result.total,
        },
      });
    } catch (error) {
      const err = error as Error;
      logger.error(`List files failed - ${err.message}`, err.stack, ctx);
      return c.json(
        {
          error: "Failed to list files",
          message: err.message,
        },
        500,
      );
    }
  });

  app.get("/stats", async (c) => {
    const requestId = getRequestId(c);
    const ctx = `req:${requestId}`;

    try {
      const stats = await fileService.getStats();

      logger.info("Retrieved file stats", ctx);

      return c.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      const err = error as Error;
      logger.error(`Get stats failed - ${err.message}`, err.stack, ctx);
      return c.json(
        {
          error: "Failed to get statistics",
          message: err.message,
        },
        500,
      );
    }
  });

  app.get("/:id", async (c) => {
    const requestId = getRequestId(c);
    const ctx = `req:${requestId}`;

    try {
      const id = c.req.param("id");
      const file = await fileService.getFile(id);

      if (!file) {
        logger.warn(`File not found - id:${id}`, ctx);
        return c.json(
          {
            error: "File not found",
            message: `File with ID ${id} not found`,
          },
          404,
        );
      }

      logger.info(`Retrieved file - id:${id}`, ctx);

      return c.json({
        success: true,
        data: file,
      });
    } catch (error) {
      const err = error as Error;
      logger.error(`Get file failed - ${err.message}`, err.stack, ctx);
      return c.json(
        {
          error: "Failed to get file",
          message: err.message,
        },
        500,
      );
    }
  });

  app.get("/:id/download", async (c) => {
    const requestId = getRequestId(c);
    const ctx = `req:${requestId}`;

    try {
      const id = c.req.param("id");
      const result = await fileService.downloadFile(id);

      if (!result) {
        logger.warn(`Download file not found - id:${id}`, ctx);
        return c.json(
          {
            error: "File not found",
            message: `File with ID ${id} not found`,
          },
          404,
        );
      }

      c.header("Content-Type", result.file.content_type);
      c.header(
        "Content-Disposition",
        `attachment; filename="${result.file.original_name}"`,
      );
      c.header("Content-Length", result.file.size.toString());

      logger.info(`Downloaded file - id:${id} size:${result.file.size}`, ctx);

      return c.body(await result.blob.arrayBuffer());
    } catch (error) {
      const err = error as Error;
      logger.error(`Download file failed - ${err.message}`, err.stack, ctx);
      return c.json(
        {
          error: "Failed to download file",
          message: err.message,
        },
        500,
      );
    }
  });

  app.get("/:id/url", async (c) => {
    const requestId = getRequestId(c);
    const ctx = `req:${requestId}`;

    try {
      const id = c.req.param("id");
      const expiresIn = Number.parseInt(c.req.query("expiresIn") || "3600", 10);

      const result = await fileService.getDownloadUrl(id, expiresIn);

      if (!result) {
        logger.warn(`Download URL file not found - id:${id}`, ctx);
        return c.json(
          {
            error: "File not found",
            message: `File with ID ${id} not found`,
          },
          404,
        );
      }

      logger.info(
        `Generated download URL - id:${id} expiresIn:${expiresIn}`,
        ctx,
      );

      return c.json({
        success: true,
        data: {
          url: result.url,
          expiresIn,
          file: {
            id: result.file.id,
            originalName: result.file.original_name,
            contentType: result.file.content_type,
            size: result.file.size,
          },
        },
      });
    } catch (error) {
      const err = error as Error;
      logger.error(`Get download URL failed - ${err.message}`, err.stack, ctx);
      return c.json(
        {
          error: "Failed to generate download URL",
          message: err.message,
        },
        500,
      );
    }
  });

  app.delete("/:id", async (c) => {
    const requestId = getRequestId(c);
    const ctx = `req:${requestId}`;

    try {
      const id = c.req.param("id");
      const deleted = await fileService.deleteFile(id);

      if (!deleted) {
        logger.warn(`Delete file not found - id:${id}`, ctx);
        return c.json(
          {
            error: "File not found",
            message: `File with ID ${id} not found`,
          },
          404,
        );
      }

      logger.info(`Deleted file - id:${id}`, ctx);

      return c.json({
        success: true,
        message: "File deleted successfully",
      });
    } catch (error) {
      const err = error as Error;
      logger.error(`Delete file failed - ${err.message}`, err.stack, ctx);
      return c.json(
        {
          error: "Failed to delete file",
          message: err.message,
        },
        500,
      );
    }
  });

  return app;
};
