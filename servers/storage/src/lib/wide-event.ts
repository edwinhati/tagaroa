import type { Context } from "hono";
import { getRequestId } from "../middleware/http.js";
import type { LoggerPort } from "../ports/logger.port.js";

export interface WideEvent {
  timestamp: string;
  level: string;
  context: string;
  message: string;
  service: string;
  version: string;
  commit: string;
  method?: string;
  path?: string;
  status_code?: number;
  duration_ms?: number;
  request_id?: string;
  outcome?: "success" | "error";
  error?: {
    message: string;
    type: string;
    stack?: string;
  };
  business?: Record<string, unknown>;
  environment?: {
    node_env: string;
    region: string;
  };
}

export interface WideEventBuilder {
  addBusiness(key: string, value: unknown): WideEventBuilder;
  addError(error: Error): WideEventBuilder;
  setStatus(status: number): WideEventBuilder;
  setDuration(durationMs: number): WideEventBuilder;
  setMessage(message: string): WideEventBuilder;
  setOutcome(outcome: "success" | "error"): WideEventBuilder;
  build(): WideEvent;
  log(logger: LoggerPort): void;
}

export function createWideEvent(context: string): WideEventBuilder {
  const event: WideEvent = {
    timestamp: new Date().toISOString(),
    level: "info",
    context,
    message: "",
    service: "storage-server",
    version: "1.0.0",
    commit: process.env.COMMIT_HASH ?? "unknown",
    business: {},
    environment: {
      node_env: process.env.NODE_ENV ?? "development",
      region: process.env.AWS_REGION ?? "unknown",
    },
  };

  return {
    addBusiness(key: string, value: unknown) {
      if (value !== undefined) {
        event.business![key] = value;
      }
      return this;
    },

    addError(error: Error) {
      event.level = "error";
      event.outcome = "error";
      event.error = {
        message: error.message,
        type: error.name,
        stack: process.env.NODE_ENV !== "production" ? error.stack : undefined,
      };
      return this;
    },

    setStatus(status: number) {
      event.status_code = status;
      if (status >= 500) {
        event.level = "error";
        event.outcome = "error";
      } else if (status >= 400) {
        event.level = "warn";
        event.outcome = "error";
      } else {
        event.outcome = "success";
      }
      return this;
    },

    setDuration(durationMs: number) {
      event.duration_ms = durationMs;
      return this;
    },

    setMessage(message: string) {
      event.message = message;
      return this;
    },

    setOutcome(outcome: "success" | "error") {
      event.outcome = outcome;
      event.level = outcome === "error" ? "error" : "info";
      return this;
    },

    build() {
      return event;
    },

    log(logger: LoggerPort) {
      logger.log(event.message, event.context);
    },
  };
}

export function buildRequestContext(c: Context): {
  method: string;
  path: string;
  request_id: string | undefined;
} {
  return {
    method: c.req.method,
    path: new URL(c.req.url).pathname,
    request_id: getRequestId(c),
  };
}
