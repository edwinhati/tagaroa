import type { Context, MiddlewareHandler } from "hono";

interface CorsMiddlewareOptions {
  origin: string | string[];
  allowMethods?: string[];
  allowHeaders?: string[];
  exposeHeaders?: string[];
  maxAge?: number;
  credentials?: boolean;
}

const DEFAULT_ALLOW_METHODS = [
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "OPTIONS",
];
const DEFAULT_ALLOW_HEADERS = ["Content-Type", "Authorization", "X-Request-Id"];
const DEFAULT_EXPOSE_HEADERS = ["Content-Length", "X-Request-Id"];

export const createCorsMiddleware = (
  options: CorsMiddlewareOptions,
): MiddlewareHandler => {
  const {
    origin,
    allowMethods = DEFAULT_ALLOW_METHODS,
    allowHeaders = DEFAULT_ALLOW_HEADERS,
    exposeHeaders = DEFAULT_EXPOSE_HEADERS,
    maxAge,
    credentials = true,
  } = options;

  return createMiddleware(async (c: Context, next: () => Promise<void>) => {
    const requestOrigin = c.req.header("Origin") ?? "";

    const isAllowedOrigin = Array.isArray(origin)
      ? origin.includes(requestOrigin)
      : origin === "*" || origin === requestOrigin;

    if (isAllowedOrigin) {
      c.header("Access-Control-Allow-Origin", requestOrigin);
    }

    if (credentials) {
      c.header("Access-Control-Allow-Credentials", "true");
    }

    if (exposeHeaders.length > 0) {
      c.header("Access-Control-Expose-Headers", exposeHeaders.join(", "));
    }

    if (maxAge !== undefined) {
      c.header("Access-Control-Max-Age", maxAge.toString());
    }

    c.header("Access-Control-Allow-Methods", allowMethods.join(", "));
    c.header("Access-Control-Allow-Headers", allowHeaders.join(", "));

    if (c.req.method === "OPTIONS") {
      return c.body(null, 204);
    }

    await next();
  });
};

export const corsMiddleware = createCorsMiddleware;

function createMiddleware(fn: MiddlewareHandler): MiddlewareHandler {
  return fn;
}
