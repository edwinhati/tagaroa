import { randomUUID } from "node:crypto";
import type { Context, MiddlewareHandler } from "hono";
import { createMiddleware } from "hono/factory";
import { config } from "./config";

export type LogLevel = "verbose" | "debug" | "log" | "warn" | "error";

export interface Logger {
  setContext(context: string): void;
  verbose(message: unknown, context?: string): void;
  debug(message: unknown, context?: string): void;
  log(message: unknown, context?: string): void;
  warn(message: unknown, context?: string): void;
  error(message: unknown, stack?: string, context?: string): void;

  // Adapter for Hono logger
  honoSink: (message: string, ...rest: unknown[]) => void;
}

// ANSI color codes
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  white: "\x1b[37m",
} as const;

const levelPriority: Record<LogLevel, number> = {
  verbose: 0,
  debug: 1,
  log: 2,
  warn: 3,
  error: 4,
};

const levelColors: Record<LogLevel, string> = {
  verbose: colors.cyan,
  debug: colors.magenta,
  log: colors.green,
  warn: colors.yellow,
  error: colors.red,
};

const levelLabels: Record<LogLevel, string> = {
  verbose: "VERBOSE",
  debug: "DEBUG",
  log: "LOG",
  warn: "WARN",
  error: "ERROR",
};

const VALID_LOG_LEVELS = new Set<LogLevel>([
  "verbose",
  "debug",
  "log",
  "warn",
  "error",
]);

function parseLogLevel(level: string): LogLevel {
  const normalized = level.toLowerCase();
  // Map common aliases
  if (normalized === "info") return "log";
  if (normalized === "trace") return "verbose";

  return VALID_LOG_LEVELS.has(normalized as LogLevel)
    ? (normalized as LogLevel)
    : "log";
}

function formatTimestamp(): string {
  const now = new Date();
  return now.toLocaleString("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

const formatMessage = (message: unknown): string => {
  if (typeof message === "string") return message;
  if (message !== null && typeof message === "object")
    return JSON.stringify(message, null, 2);
  return String(message);
};
const [CONTEXT_PREFIX, CONTEXT_SUFFIX] = (() => {
  const prefix = `${colors.yellow}[`;
  const suffix = `]${colors.reset} `;
  return [prefix, suffix] as const;
})();

export const createLogger = (context?: string): Logger => {
  const minLevel = parseLogLevel(config.logLevel);
  let currentContext = context || "";

  const shouldLog = (level: LogLevel): boolean =>
    levelPriority[level] >= levelPriority[minLevel];

  const printMessage = (
    level: LogLevel,
    message: unknown,
    context?: string,
    stack?: string,
  ) => {
    if (!shouldLog(level)) return;

    const timestamp = formatTimestamp();
    const levelColor = levelColors[level];
    const levelLabel = levelLabels[level];
    const resolvedContext = context || currentContext;
    const contextStr = resolvedContext
      ? `${CONTEXT_PREFIX}${resolvedContext}${CONTEXT_SUFFIX}`
      : "";
    const messageStr = formatMessage(message);

    const logLine = `${colors.green}[Auth Server] ${process.pid}${colors.reset} - ${colors.dim}${timestamp}${colors.reset} ${levelColor}${levelLabel}${colors.reset} ${contextStr}${messageStr}`;

    if (config.isProduction) {
      // In production, output structured JSON
      const payload = {
        timestamp: new Date().toISOString(),
        level: level === "log" ? "info" : level,
        context: context || currentContext,
        message: messageStr,
        ...(stack && { stack }),
      };
      console.log(JSON.stringify(payload));
    } else {
      // In development, use colorful console output
      console.log(logLine);
      if (stack) {
        console.log(`${colors.red}${stack}${colors.reset}`);
      }
    }
  };

  const logger: Logger = {
    setContext(ctx: string) {
      currentContext = ctx;
    },

    verbose(message: unknown, context?: string) {
      printMessage("verbose", message, context);
    },

    debug(message: unknown, context?: string) {
      printMessage("debug", message, context);
    },

    log(message: unknown, context?: string) {
      printMessage("log", message, context);
    },

    warn(message: unknown, context?: string) {
      printMessage("warn", message, context);
    },

    error(message: unknown, stack?: string, context?: string) {
      printMessage("error", message, context, stack);
    },

    honoSink: (message: string, ..._rest: unknown[]) => {
      logger.debug(message, "HonoLogger");
    },
  };

  return logger;
};

interface RequestInfo {
  requestId: string;
  method: string;
  path: string;
  ip?: string;
  ua?: string;
  referer?: string;
  [key: string]: unknown;
}

const extractClientIp = (headers: Headers): string | undefined => {
  return (
    headers.get("x-forwarded-for") ||
    headers.get("cf-connecting-ip") ||
    headers.get("x-real-ip") ||
    undefined
  );
};

const buildRequestInfo = (c: Context, requestId: string): RequestInfo => ({
  requestId,
  method: c.req.method,
  path: new URL(c.req.url).pathname,
  ip: extractClientIp(c.req.raw.headers),
  ua: c.req.header("user-agent"),
  referer: c.req.header("referer"),
});

export const httpMiddleware = (logger: Logger): MiddlewareHandler =>
  createMiddleware(async (c, next) => {
    const start = performance.now();

    // Request ID (respect incoming one if present)
    const incomingId =
      c.req.header("x-request-id") || c.req.header("x-correlation-id");
    const requestId = incomingId || randomUUID();

    // Make it available downstream
    c.set("requestId", requestId);
    c.set("logger", logger);

    const reqInfo = buildRequestInfo(c, requestId);

    // Log request start
    logger.log(
      `${reqInfo.method} ${reqInfo.path} - ${reqInfo.ip || "unknown"}`,
      "HTTP",
    );

    try {
      await next();

      const ms = Math.round(performance.now() - start);
      const status = c.res.status;

      // Echo request-id to client and proxies
      c.res.headers.set("x-request-id", requestId);

      // Log successful request
      let statusColor: string = colors.green;
      if (status >= 400) {
        statusColor = colors.red;
      } else if (status >= 300) {
        statusColor = colors.yellow;
      }
      logger.log(
        `${reqInfo.method} ${reqInfo.path} ${statusColor}${status}${colors.reset} - ${ms}ms`,
        "HTTP",
      );
    } catch (err) {
      const ms = Math.round(performance.now() - start);
      const error = err as Error;

      // Log error with full stack in development
      logger.error(
        `${reqInfo.method} ${reqInfo.path} - ${error.message} - ${ms}ms`,
        config.isDevelopment ? error.stack : undefined,
        "HTTP",
      );

      const headers = new Headers(c.res?.headers ?? undefined);
      headers.set("x-request-id", requestId);

      if (config.isDevelopment) {
        headers.set("content-type", "application/json");
      }

      const responseBody =
        config.isDevelopment && error instanceof Error
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
