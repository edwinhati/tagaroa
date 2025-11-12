import { afterEach, beforeEach, describe, expect, test, mock } from "bun:test";

type ConfigMock = {
  port: number;
  nodeEnv: "development" | "production";
  logLevel: string;
  readonly isDevelopment: boolean;
  readonly isProduction: boolean;
};

const configMock: ConfigMock = {
  port: 8080,
  nodeEnv: "development",
  logLevel: "info",
  get isDevelopment() {
    return this.nodeEnv !== "production";
  },
  get isProduction() {
    return this.nodeEnv === "production";
  },
};

mock.module("../config", () => ({
  config: configMock,
}));

const { createLogger, httpMiddleware } = await import("../logger");

const captureConsole = () => {
  const original = console.log;
  const calls: unknown[][] = [];
  console.log = (...args: unknown[]) => {
    calls.push(args);
  };

  const restore = () => {
    console.log = original;
  };

  return { calls, restore };
};

const ansiEscapePattern = /\u001b\[[0-9;]*m/g;

beforeEach(() => {
  configMock.nodeEnv = "development";
  configMock.logLevel = "info";
});

afterEach(() => {
  configMock.nodeEnv = "development";
  configMock.logLevel = "info";
});

describe("createLogger", () => {
  test("supports trace alias and logs structured output in production", () => {
    configMock.nodeEnv = "production";
    configMock.logLevel = "trace";
    const logger = createLogger("ProdCtx");
    const { calls, restore } = captureConsole();

    try {
      logger.verbose("trace test");
    } finally {
      restore();
    }

    expect(calls.length).toBeGreaterThan(0);
    const [firstCall] = calls;
    expect(typeof firstCall[0]).toBe("string");
    const payload = JSON.parse(firstCall[0] as string);
    expect(payload.level).toBe("verbose");
    expect(payload.context).toBe("ProdCtx");
    expect(payload.message).toBe("trace test");
  });

  test("supports info alias", () => {
    configMock.logLevel = "info";
    const logger = createLogger();
    const { calls, restore } = captureConsole();

    try {
      logger.debug("should not log");
      logger.log("should log");
    } finally {
      restore();
    }

    expect(calls.length).toBe(1);
    expect(String(calls[0][0])).toContain("should log");
  });

  test("falls back to info when log level is unknown", () => {
    configMock.logLevel = "unknown-level";
    const logger = createLogger();
    const { calls, restore } = captureConsole();

    try {
      logger.debug("should skip because min level defaults to info");
      logger.log("should log");
    } finally {
      restore();
    }

    expect(calls.length).toBe(1);
    expect(String(calls[0][0])).toContain("should log");
  });

  test("formats context, objects and stack traces in development", () => {
    configMock.nodeEnv = "development";
    configMock.logLevel = "debug";
    const logger = createLogger();
    const { calls, restore } = captureConsole();

    try {
      logger.setContext("Ctx");
      logger.warn({ message: "test" });
      logger.warn(42);
      logger.error("failed", "stack-trace", "Ctx");
      logger.honoSink("hono message");
    } finally {
      restore();
    }

    expect(calls.length).toBeGreaterThanOrEqual(3);

    const strippedCalls = calls.map(([first]) =>
      typeof first === "string"
        ? (first as string).replaceAll(ansiEscapePattern, "")
        : first,
    );
    const stringCalls = strippedCalls.filter(
      (line): line is string => typeof line === "string",
    );

    expect(stringCalls).toEqual(
      expect.arrayContaining([expect.stringContaining("[Ctx]")]),
    );
    expect(stringCalls).toEqual(
      expect.arrayContaining([expect.stringContaining('"message": "test"')]),
    );
    expect(stringCalls).toEqual(
      expect.arrayContaining([expect.stringContaining("42")]),
    );
    expect(stringCalls).toEqual(
      expect.arrayContaining([expect.stringContaining("stack-trace")]),
    );
    expect(stringCalls).toEqual(
      expect.arrayContaining([expect.stringContaining("hono message")]),
    );
  });

  test("respects explicit warn threshold", () => {
    configMock.logLevel = "warn";
    const logger = createLogger();
    const { calls, restore } = captureConsole();

    try {
      logger.verbose("ignored");
      logger.debug("ignored");
      logger.warn("should appear");
    } finally {
      restore();
    }

    expect(calls.length).toBe(1);
    expect(String(calls[0][0])).toContain("should appear");
  });
});

describe("httpMiddleware", () => {
  test("propagates request ids and logs errors when downstream fails", async () => {
    const logger = createLogger();
    const { calls, restore } = captureConsole();
    const setMock = mock(() => {});

    const middleware = httpMiddleware(logger);
    const request = new Request("http://example.com/api/auth/session", {
      method: "GET",
      headers: { "x-request-id": "middleware-test" },
    });

    const headers = new Headers();
    const context: any = {
      req: {
        raw: request,
        url: request.url,
        method: request.method,
        header: (name: string) => request.headers.get(name),
      },
      res: {
        status: 200,
        headers,
      },
      set: setMock,
    };

    const next = async () => {
      context.res.status = 500;
      throw new Error("middleware failure");
    };

    const response = await middleware(context, next);

    restore();

    expect(response).toBeInstanceOf(Response);
    expect(response.status).toBe(500);
    expect(response.headers.get("x-request-id")).toBe("middleware-test");
    expect(setMock).toHaveBeenCalledWith("requestId", "middleware-test");
    expect(setMock).toHaveBeenCalledWith("logger", logger);
    const errorLines = calls
      .map(([line]) => (typeof line === "string" ? line : null))
      .filter((line): line is string => line !== null);
    expect(errorLines).toEqual(
      expect.arrayContaining([expect.stringContaining("middleware failure")]),
    );
  });

  test("logs success and handles various ip headers", async () => {
    const logger = createLogger("HTTP");
    const { calls, restore } = captureConsole();
    const setMock = mock(() => {});

    const middleware = httpMiddleware(logger);

    const run = async (headers: Record<string, string>) => {
      const request = new Request("http://example.com/success", {
        method: "GET",
        headers,
      });
      const context: any = {
        req: {
          raw: request,
          url: request.url,
          method: request.method,
          header: (name: string) => request.headers.get(name),
        },
        res: { status: 200, headers: new Headers() },
        set: setMock,
      };
      await middleware(context, async () => {});
    };

    await run({ "x-forwarded-for": "x-forwarded-for-ip" });
    await run({ "cf-connecting-ip": "cf-connecting-ip-ip" });
    await run({ "x-real-ip": "x-real-ip-ip" });
    // No request id
    await run({});

    restore();

    const logLines = calls
      .map(([line]) =>
        typeof line === "string"
          ? line.replaceAll(ansiEscapePattern, "")
          : null,
      )
      .filter((line): line is string => line !== null);

    expect(logLines).toEqual(
      expect.arrayContaining([
        expect.stringContaining("GET /success - x-forwarded-for-ip"),
        expect.stringContaining("GET /success 200"),
        expect.stringContaining("GET /success - cf-connecting-ip-ip"),
        expect.stringContaining("GET /success - x-real-ip-ip"),
        expect.stringContaining("GET /success - unknown"),
      ]),
    );
  });

  test("logs 3xx and 4xx status codes with correct colors", async () => {
    const logger = createLogger("HTTP");
    const { calls, restore } = captureConsole();
    const setMock = mock(() => {});
    const middleware = httpMiddleware(logger);

    const run = async (status: number) => {
      const request = new Request(`http://example.com/${status}`);
      const context: any = {
        req: {
          raw: request,
          url: request.url,
          method: "GET",
          header: (name: string) => request.headers.get(name),
        },
        res: { status, headers: new Headers() },
        set: setMock,
      };
      await middleware(context, async () => {});
    };

    await run(302);
    await run(404);

    restore();

    const logLines = calls.map(([line]) => line);
    expect(logLines).toEqual(
      expect.arrayContaining([
        // 302 should have yellow color
        expect.stringContaining("\x1b[33m302\x1b[0m"),
        // 404 should have red color
        expect.stringContaining("\x1b[31m404\x1b[0m"),
      ]),
    );
  });
});
