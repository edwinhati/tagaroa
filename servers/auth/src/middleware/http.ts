import { randomUUID } from "node:crypto";
import type { MiddlewareHandler } from "hono";
import { createMiddleware } from "hono/factory";
import type { Logger } from "../logger";

interface HttpMiddlewareOptions {
  logger: Logger;
}

export const createHttpMiddleware = ({
  logger,
}: HttpMiddlewareOptions): MiddlewareHandler =>
  createMiddleware(async (c, next) => {
    const start = performance.now();

    const incomingId =
      c.req.header("x-request-id") || c.req.header("x-correlation-id");
    const requestId = incomingId || randomUUID();

    c.set("requestId", requestId);
    c.set("logger", logger);

    const method = c.req.method;
    const path = new URL(c.req.url).pathname;

    const ip =
      c.req.header("x-forwarded-for")?.split(",")[0].trim() ||
      c.req.header("cf-connecting-ip") ||
      c.req.header("x-real-ip");

    const logMethod = logger.log ?? logger.info ?? (() => {});
    logMethod.call(logger, `${method} ${path} - ${ip || "unknown"}`, "HTTP");

    try {
      await next();

      const durationMs = Math.round(performance.now() - start);
      const statusCode = c.res.status;

      c.res.headers.set("x-request-id", requestId);

      let statusColor = "\x1b[32m";
      if (statusCode >= 400) statusColor = "\x1b[31m";
      else if (statusCode >= 300) statusColor = "\x1b[33m";

      const logStatus = logger.log ?? logger.info ?? (() => {});
      logStatus.call(
        logger,
        `${method} ${path} ${statusColor}${statusCode}\x1b[0m - ${durationMs}ms`,
        "HTTP",
      );
    } catch (err) {
      const durationMs = Math.round(performance.now() - start);
      const error = err as Error;

      logger.error(
        `${method} ${path} - ${error.message} - ${durationMs}ms`,
        process.env.NODE_ENV === "development" ? error.stack : undefined,
        "HTTP",
      );

      const headers = new Headers(c.res?.headers ?? undefined);
      headers.set("x-request-id", requestId);

      if (process.env.NODE_ENV === "development") {
        headers.set("content-type", "application/json");
      }

      const responseBody =
        process.env.NODE_ENV === "development"
          ? JSON.stringify({
              error: "Internal Server Error",
              message: error.message,
              requestId,
            })
          : null;

      return new Response(responseBody, {
        status: 500,
        headers,
      });
    }
  });

export const httpMiddleware = (logger: Logger): MiddlewareHandler =>
  createHttpMiddleware({ logger });
