import type { Context } from "hono";

export interface LoggerPort {
  setContext(context: string): void;
  verbose(message: unknown, context?: string): void;
  debug(message: unknown, context?: string): void;
  info(message: unknown, context?: string): void;
  log(message: unknown, context?: string): void;
  warn(message: unknown, context?: string): void;
  error(message: unknown, stack?: string, context?: string): void;
}

export const createLoggerPort = (): LoggerPort => {
  let currentContext = "StorageServer";

  return {
    setContext(context: string) {
      currentContext = context;
    },
    verbose(message: unknown, context?: string) {
      console.log(`[VERBOSE] [${context ?? currentContext}]`, message);
    },
    debug(message: unknown, context?: string) {
      console.log(`[DEBUG] [${context ?? currentContext}]`, message);
    },
    info(message: unknown, context?: string) {
      console.log(`[INFO] [${context ?? currentContext}]`, message);
    },
    log(message: unknown, context?: string) {
      console.log(`[LOG] [${context ?? currentContext}]`, message);
    },
    warn(message: unknown, context?: string) {
      console.warn(`[WARN] [${context ?? currentContext}]`, message);
    },
    error(message: unknown, stack?: string, context?: string) {
      console.error(`[ERROR] [${context ?? currentContext}]`, message);
      if (stack) {
        console.error(stack);
      }
    },
  };
};

export interface HonoLoggerSink {
  write(message: string): void;
}

export const loggerSink: HonoLoggerSink = {
  write(message: string) {
    console.log(message);
  },
};
