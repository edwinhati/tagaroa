/**
 * OpenTelemetry trace context middleware
 * Injects trace ID into Hono context for error responses
 */

import { context, trace } from "@opentelemetry/api";
import type { MiddlewareHandler } from "hono";

declare module "hono" {
  interface ContextVariableMap {
    traceId?: string;
  }
}

/**
 * Middleware that captures the current trace ID from OpenTelemetry
 * and stores it in the Hono context for use in error responses
 */
export const traceMiddleware: MiddlewareHandler = async (c, next) => {
  const currentSpan = trace.getSpan(context.active());

  if (currentSpan) {
    const spanContext = currentSpan.spanContext();
    if (spanContext?.traceId) {
      c.set("traceId", spanContext.traceId);
    }
  }

  await next();
};
