import { config } from "./config";
import { randomUUID } from "node:crypto";
import type { MiddlewareHandler } from "hono";
import { createMiddleware } from "hono/factory";

export type LogLevel = "verbose" | "debug" | "log" | "warn" | "error";

export type LogContext = string;

export interface Logger {
  setContext(context: string): void;
  verbose(message: any, context?: LogContext): void;
  debug(message: any, context?: LogContext): void;
  log(message: any, context?: LogContext): void;
  warn(message: any, context?: LogContext): void;
  error(message: any, stack?: string, context?: LogContext): void;

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

const VALID_LOG_LEVELS: LogLevel[] = [
  "verbose",
  "debug",
  "log",
  "warn",
  "error",
];

function parseLogLevel(level: string): LogLevel {
  const normalized = level.toLowerCase();
  // Map common aliases
  if (normalized === "info") return "log";
  if (normalized === "trace") return "verbose";

  return VALID_LOG_LEVELS.includes(normalized as LogLevel)
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

function formatMessage(message: any): string {
  if (typeof message === "string") return message;
  if (typeof message === "object") return JSON.stringify(message, null, 2);
  return String(message);
}

function formatContext(context?: string): string {
  return context ? `${colors.yellow}[${context}]${colors.reset} ` : "";
}

export function createLogger(context?: string): Logger {
  const minLevel = parseLogLevel(config.logLevel);
  let currentContext = context || "";

  const shouldLog = (level: LogLevel): boolean =>
    levelPriority[level] >= levelPriority[minLevel];

  const printMessage = (
    level: LogLevel,
    message: any,
    context?: string,
    stack?: string
  ) => {
    if (!shouldLog(level)) return;

    const timestamp = formatTimestamp();
    const levelColor = levelColors[level];
    const levelLabel = levelLabels[level];
    const contextStr = formatContext(context || currentContext);
    const messageStr = formatMessage(message);

    const logLine = `${colors.green}[Auth Server] ${process.pid}${colors.reset}  - ${colors.dim}${timestamp}${colors.reset}     ${levelColor}${levelLabel}${colors.reset} ${contextStr}${messageStr}`;

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

    verbose(message: any, context?: LogContext) {
      printMessage("verbose", message, context);
    },

    debug(message: any, context?: LogContext) {
      printMessage("debug", message, context);
    },

    log(message: any, context?: LogContext) {
      printMessage("log", message, context);
    },

    warn(message: any, context?: LogContext) {
      printMessage("warn", message, context);
    },

    error(message: any, stack?: string, context?: LogContext) {
      printMessage("error", message, context, stack);
    },

    honoSink: (message: string, ...rest: unknown[]) => {
      logger.debug(message, "HonoLogger");
    },
  };

  return logger;
}

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

const buildRequestInfo = (c: any, requestId: string): RequestInfo => ({
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

    const reqInfo = buildRequestInfo(c, requestId);

    // Log request start
    logger.log(
      `${reqInfo.method} ${reqInfo.path} - ${reqInfo.ip || "unknown"}`,
      "HTTP"
    );

    try {
      await next();

      const ms = Math.round(performance.now() - start);
      const status = c.res.status;

      // Echo request-id to client and proxies
      c.res.headers.set("x-request-id", requestId);

      // Log successful request
      const statusColor =
        status >= 400
          ? colors.red
          : status >= 300
            ? colors.yellow
            : colors.green;
      logger.log(
        `${reqInfo.method} ${reqInfo.path} ${statusColor}${status}${colors.reset} - ${ms}ms`,
        "HTTP"
      );
    } catch (err) {
      const ms = Math.round(performance.now() - start);
      const error = err as Error;

      // Ensure header even on error paths
      c.res?.headers?.set?.("x-request-id", requestId);

      // Log error
      logger.error(
        `${reqInfo.method} ${reqInfo.path} - ${error.message} - ${ms}ms`,
        config.isDevelopment ? error.stack : undefined,
        "HTTP"
      );

      throw err; // Let Hono handle the actual response
    }
  });
