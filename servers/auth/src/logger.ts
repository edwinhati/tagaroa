import { config } from "./config";

export type LogLevel = "verbose" | "debug" | "info" | "warn" | "error";

export interface Logger {
  setContext(context: string): void;
  verbose(message: unknown, context?: string): void;
  debug(message: unknown, context?: string): void;
  info(message: unknown, context?: string): void;
  log(message: unknown, context?: string): void;
  warn(message: unknown, context?: string): void;
  error(message: unknown, stack?: string, context?: string): void;

  honoSink: (message: string, ...rest: unknown[]) => void;
}

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
  info: 2,
  warn: 3,
  error: 4,
};

const levelColors: Record<LogLevel, string> = {
  verbose: colors.cyan,
  debug: colors.magenta,
  info: colors.green,
  warn: colors.yellow,
  error: colors.red,
};

const levelLabels: Record<LogLevel, string> = {
  verbose: "VERBOSE",
  debug: "DEBUG",
  info: "INFO",
  warn: "WARN",
  error: "ERROR",
};

const VALID_LOG_LEVELS = new Set<LogLevel>([
  "verbose",
  "debug",
  "info",
  "warn",
  "error",
]);

function parseLogLevel(level: string): LogLevel {
  const normalized = level.toLowerCase();
  if (normalized === "info") return "info";
  if (normalized === "trace") return "verbose";
  return VALID_LOG_LEVELS.has(normalized as LogLevel)
    ? (normalized as LogLevel)
    : "info";
}

function formatTimestamp(): string {
  return new Date().toISOString();
}

const formatMessage = (message: unknown): string => {
  if (typeof message === "string") return message;
  if (message !== null && typeof message === "object")
    return JSON.stringify(message, null, 2);
  return String(message);
};

const [CONTEXT_PREFIX, CONTEXT_SUFFIX] = [
  `${colors.yellow}[`,
  `]${colors.reset} `,
] as const;

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
      const payload: Record<string, unknown> = {
        timestamp,
        level,
        context: resolvedContext,
        message: messageStr,
        service: "auth-server",
        version: process.env.SERVICE_VERSION || "unknown",
        commit: process.env.GIT_COMMIT || "unknown",
      };
      if (stack) payload.stack = stack;
      console.log(JSON.stringify(payload));
    } else {
      console.log(logLine);
      if (stack) console.log(`${colors.red}${stack}${colors.reset}`);
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

    info(message: unknown, context?: string) {
      printMessage("info", message, context);
    },

    log(message: unknown, context?: string) {
      printMessage("info", message, context);
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
