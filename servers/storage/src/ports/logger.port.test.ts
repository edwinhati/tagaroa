import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import type { HonoLoggerSink, LoggerPort } from "../ports/logger.port.js";

const captureConsole = () => {
  const calls: { method: string; args: unknown[] }[] = [];
  const original = {
    log: console.log,
    warn: console.warn,
    error: console.error,
  };

  console.log = (...args: unknown[]) => calls.push({ method: "log", args });
  console.warn = (...args: unknown[]) => calls.push({ method: "warn", args });
  console.error = (...args: unknown[]) => calls.push({ method: "error", args });

  const restore = () => {
    console.log = original.log;
    console.warn = original.warn;
    console.error = original.error;
  };

  return { calls, restore };
};

describe("LoggerPort", () => {
  let createLoggerPort: () => LoggerPort;
  let loggerSink: HonoLoggerSink;

  beforeEach(async () => {
    // Re-import to get fresh instance
    const module = await import("../ports/logger.port");
    createLoggerPort = module.createLoggerPort;
    loggerSink = module.loggerSink;
  });

  test("setContext changes the context for subsequent logs", () => {
    const logger = createLoggerPort();
    const { calls, restore } = captureConsole();

    try {
      logger.setContext("NewContext");
      logger.info("test message");
    } finally {
      restore();
    }

    expect(calls.length).toBeGreaterThan(0);
    expect(String(calls[0].args[0])).toContain("[NewContext]");
  });

  test("verbose logs with VERBOSE prefix", () => {
    const logger = createLoggerPort();
    const { calls, restore } = captureConsole();

    try {
      logger.verbose("verbose message");
    } finally {
      restore();
    }

    expect(calls.length).toBe(1);
    expect(calls[0].method).toBe("log");
    expect(String(calls[0].args[0])).toContain("[VERBOSE]");
  });

  test("debug logs with DEBUG prefix", () => {
    const logger = createLoggerPort();
    const { calls, restore } = captureConsole();

    try {
      logger.debug("debug message");
    } finally {
      restore();
    }

    expect(calls.length).toBe(1);
    expect(calls[0].method).toBe("log");
    expect(String(calls[0].args[0])).toContain("[DEBUG]");
  });

  test("info logs with INFO prefix", () => {
    const logger = createLoggerPort();
    const { calls, restore } = captureConsole();

    try {
      logger.info("info message");
    } finally {
      restore();
    }

    expect(calls.length).toBe(1);
    expect(calls[0].method).toBe("log");
    expect(String(calls[0].args[0])).toContain("[INFO]");
  });

  test("log logs with LOG prefix", () => {
    const logger = createLoggerPort();
    const { calls, restore } = captureConsole();

    try {
      logger.log("log message");
    } finally {
      restore();
    }

    expect(calls.length).toBe(1);
    expect(calls[0].method).toBe("log");
    expect(String(calls[0].args[0])).toContain("[LOG]");
  });

  test("warn logs with WARN prefix", () => {
    const logger = createLoggerPort();
    const { calls, restore } = captureConsole();

    try {
      logger.warn("warn message");
    } finally {
      restore();
    }

    expect(calls.length).toBe(1);
    expect(calls[0].method).toBe("warn");
    expect(String(calls[0].args[0])).toContain("[WARN]");
  });

  test("error logs with ERROR prefix and includes stack trace", () => {
    const logger = createLoggerPort();
    const { calls, restore } = captureConsole();

    try {
      logger.error("error message", "stack trace line", "ErrorContext");
    } finally {
      restore();
    }

    expect(calls.length).toBe(2); // error + stack trace
    expect(calls[0].method).toBe("error");
    expect(String(calls[0].args[0])).toContain("[ERROR]");
    expect(calls[0].args).toContain("error message");
    expect(calls[1].args).toContain("stack trace line");
  });

  test("error logs without stack trace when not provided", () => {
    const logger = createLoggerPort();
    const { calls, restore } = captureConsole();

    try {
      logger.error("error message");
    } finally {
      restore();
    }

    expect(calls.length).toBe(1); // only error, no stack trace
    expect(calls[0].method).toBe("error");
  });

  test("context parameter overrides current context", () => {
    const logger = createLoggerPort();
    const { calls, restore } = captureConsole();

    try {
      logger.setContext("DefaultContext");
      logger.info("message with default context", "OverrideContext");
    } finally {
      restore();
    }

    expect(calls.length).toBe(1);
    expect(String(calls[0].args[0])).toContain("[OverrideContext]");
  });

  test("loggerSink write method logs to console", () => {
    const { calls, restore } = captureConsole();

    try {
      loggerSink.write("test sink message");
    } finally {
      restore();
    }

    expect(calls.length).toBe(1);
    expect(calls[0].args).toContain("test sink message");
  });
});
