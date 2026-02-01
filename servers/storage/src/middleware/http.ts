import type { Context, MiddlewareHandler } from "hono";
import type { LoggerPort } from "../ports/logger.port.js";

interface HttpMiddlewareOptions {
  logger: LoggerPort;
}

export const createHttpMiddleware = ({
  logger,
}: HttpMiddlewareOptions): MiddlewareHandler =>
  createMiddleware(async (c: Context, next: () => Promise<void>) => {
    const requestStart = Date.now();
    const requestId =
      c.req.header("x-request-id") ??
      c.req.header("x-correlation-id") ??
      crypto.randomUUID();
    c.set("requestId", requestId);
    c.set("requestStart", requestStart);
    c.set("logger", logger);

    await next();

    const duration = Date.now() - (c.get("requestStart") as number);
    const method = c.req.method;
    const path = new URL(c.req.url).pathname;
    const status = c.res.status;

    const context = `req:${requestId}`;

    if (status >= 500) {
      const body = await c.res.text();
      const isDevelopment = process.env.NODE_ENV !== "production";
      logger.error(
        `${method} ${path} ${status} - ${duration}ms`,
        isDevelopment ? body : undefined,
        context,
      );
    } else if (status >= 400) {
      logger.warn(`${method} ${path} ${status} - ${duration}ms`, context);
    } else {
      logger.info(`${method} ${path} ${status} - ${duration}ms`, context);
    }

    c.header("x-request-id", requestId);
  });

export const httpMiddleware = createHttpMiddleware;

function createMiddleware(fn: MiddlewareHandler): MiddlewareHandler {
  return fn;
}

export function getRequestId(c: Context): string | undefined {
  return c.get("requestId");
}

export function getLogger(c: Context): LoggerPort | undefined {
  return c.get("logger");
}
