import type { Context } from "hono";
import type { LoggerPort } from "./ports/logger.port.js";

const isDevelopment = process.env.NODE_ENV !== "production";
const SERVICE = "storage-server";
const VERSION = "1.0.0";
const COMMIT = process.env.COMMIT_HASH ?? "unknown";

interface WideEvent {
  timestamp: string;
  level: string;
  context: string;
  message: string;
  service: typeof SERVICE;
  version: typeof VERSION;
  commit: typeof COMMIT;
  method?: string;
  path?: string;
  status_code?: number;
  duration_ms?: number;
  request_id?: string;
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

type HonoSink = (message: string, ...rest: unknown[]) => void;

export function createLogger(
  context?: string,
): LoggerPort & { honoSink: HonoSink } {
  let currentContext = context ?? "StorageServer";

  const log = (
    level: string,
    msg: unknown,
    contextStr?: string,
    extra?: Record<string, unknown>,
  ) => {
    const logContext = contextStr ?? currentContext;

    if (isDevelopment) {
      console[level === "error" ? "error" : "log"](
        `[${new Date().toISOString()}] [${level.toUpperCase()}] [${logContext}]`,
        msg,
        extra ? JSON.stringify(extra, null, 2) : "",
      );
      return;
    }

    const event: WideEvent = {
      timestamp: new Date().toISOString(),
      level,
      context: logContext,
      message: typeof msg === "string" ? msg : JSON.stringify(msg),
      service: SERVICE,
      version: VERSION,
      commit: COMMIT,
      ...extra,
    };

    console.log(JSON.stringify(event));
  };

  const logger: LoggerPort = {
    setContext(newContext: string) {
      currentContext = newContext;
    },

    verbose(message: unknown, contextStr?: string) {
      log("verbose", message, contextStr);
    },

    debug(message: unknown, contextStr?: string) {
      log("debug", message, contextStr);
    },

    info(message: unknown, contextStr?: string) {
      log("info", message, contextStr);
    },

    log(message: unknown, contextStr?: string) {
      log("info", message, contextStr);
    },

    warn(message: unknown, contextStr?: string) {
      log("warn", message, contextStr);
    },

    error(message: unknown, stack?: string, contextStr?: string) {
      const errorPayload: Record<string, unknown> = {};
      if (stack) {
        errorPayload.stack = stack;
      }
      log("error", message, contextStr, { error: errorPayload });
    },
  };

  return {
    ...logger,
    honoSink: (message: string, ..._rest: unknown[]) => {
      logger.debug(message, "HonoLogger");
    },
  };
}

export function getRequestId(c: Context): string | undefined {
  return c.get("requestId");
}

export function buildWideEvent(
  c: Context,
  overrides?: Partial<WideEvent>,
): WideEvent {
  return {
    timestamp: new Date().toISOString(),
    service: SERVICE,
    version: VERSION,
    commit: COMMIT,
    environment: {
      node_env: process.env.NODE_ENV ?? "development",
      region: process.env.AWS_REGION ?? "unknown",
    },
    method: c.req.method,
    path: new URL(c.req.url).pathname,
    request_id: getRequestId(c),
    level: "info",
    context: "StorageServer",
    message: "",
    ...overrides,
  };
}
