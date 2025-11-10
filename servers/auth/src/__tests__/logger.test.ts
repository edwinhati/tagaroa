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
    expect(
      String(calls[0][0]).includes("should log"),
    ).toBeTruthy();
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
        ? (first as string).replace(/\x1b\[[0-9;]*m/g, "")
        : first,
    );

    expect(
      strippedCalls.some((line) => typeof line === "string" && line.includes("[Ctx]")),
    ).toBeTruthy();
    expect(
      strippedCalls.some((line) => typeof line === "string" && line.includes('"message": "test"')),
    ).toBeTruthy();
    expect(
      strippedCalls.some((line) => typeof line === "string" && line.includes("42")),
    ).toBeTruthy();
    expect(
      strippedCalls.some((line) => typeof line === "string" && line.includes("stack-trace")),
    ).toBeTruthy();
    expect(
      strippedCalls.some((line) => typeof line === "string" && line.includes("hono message")),
    ).toBeTruthy();
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
    expect(
      String(calls[0][0]).includes("should appear"),
    ).toBeTruthy();
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
    expect(
      calls.some(([line]) => typeof line === "string" && line.includes("middleware failure")),
    ).toBeTruthy();
  });
});
