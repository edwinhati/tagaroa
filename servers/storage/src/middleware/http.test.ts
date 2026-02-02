import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { Hono } from "hono";
import type { LoggerPort } from "../ports/logger.port.js";

const captureConsole = () => {
  const calls: unknown[][] = [];
  const original = {
    log: console.log,
    warn: console.warn,
    error: console.error,
  };

  console.log = (...args: unknown[]) => calls.push(["log", ...args]);
  console.warn = (...args: unknown[]) => calls.push(["warn", ...args]);
  console.error = (...args: unknown[]) => calls.push(["error", ...args]);

  const restore = () => {
    console.log = original.log;
    console.warn = original.warn;
    console.error = original.error;
  };

  return { calls, restore };
};

type HttpMiddlewareFactory = (opts: {
  logger: LoggerPort;
}) => import("hono").MiddlewareHandler;

describe("storage httpMiddleware", () => {
  let httpMiddleware: HttpMiddlewareFactory;
  let mockLogger: LoggerPort;

  beforeEach(async () => {
    const { createLoggerPort } = await import("../ports/logger.port");
    mockLogger = createLoggerPort();
    const module = await import("../middleware/http");
    httpMiddleware = module.createHttpMiddleware;
  });

  test("sets requestId from x-request-id header", async () => {
    const app = new Hono();
    app.use("*", httpMiddleware({ logger: mockLogger }));
    app.get("/test", (c) => c.json({ requestId: c.get("requestId") }));

    const response = await app.request("/test", {
      headers: { "x-request-id": "test-123" },
    });

    expect(await response.json()).toEqual({ requestId: "test-123" });
  });

  test("sets requestId from x-correlation-id header when x-request-id is missing", async () => {
    const app = new Hono();
    app.use("*", httpMiddleware({ logger: mockLogger }));
    app.get("/test", (c) => c.json({ requestId: c.get("requestId") }));

    const response = await app.request("/test", {
      headers: { "x-correlation-id": "corr-123" },
    });

    expect(await response.json()).toEqual({ requestId: "corr-123" });
  });

  test("generates random uuid when no request id headers present", async () => {
    const app = new Hono();
    app.use("*", httpMiddleware({ logger: mockLogger }));
    app.get("/test", (c) => c.json({ requestId: c.get("requestId") }));

    const response = await app.request("/test");

    const body = await response.json();
    expect(body.requestId).toBeTruthy();
    expect(typeof body.requestId).toBe("string");
    expect(body.requestId.length).toBeGreaterThan(0);
  });

  test("sets requestStart timestamp", async () => {
    const app = new Hono();
    app.use("*", httpMiddleware({ logger: mockLogger }));
    app.get("/test", (c) => {
      const requestStart = c.get("requestStart");
      return c.json({ hasStart: typeof requestStart === "number" });
    });

    const response = await app.request("/test");
    expect(await response.json()).toEqual({ hasStart: true });
  });

  test("sets logger in context", async () => {
    const app = new Hono();
    app.use("*", httpMiddleware({ logger: mockLogger }));
    app.get("/test", (c) => {
      const logger = c.get("logger");
      return c.json({ hasLogger: typeof logger === "object" });
    });

    const response = await app.request("/test");
    expect(await response.json()).toEqual({ hasLogger: true });
  });

  test("logs 5xx errors with body in development", async () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "development";

    const { calls, restore } = captureConsole();

    try {
      const app = new Hono();
      app.use("*", httpMiddleware({ logger: mockLogger }));
      app.get("/error", () => {
        return new Response("internal error", { status: 500 });
      });

      await app.request("/error");
    } finally {
      restore();
      process.env.NODE_ENV = originalEnv;
    }

    expect(calls.length).toBeGreaterThan(0);
    const errorCalls = calls.filter((c) => c[0] === "error");
    expect(errorCalls.length).toBeGreaterThan(0);
  });

  test("logs 5xx errors without body in production", async () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";

    const { calls, restore } = captureConsole();

    try {
      const app = new Hono();
      app.use("*", httpMiddleware({ logger: mockLogger }));
      app.get("/error", () => {
        return new Response("internal error", { status: 500 });
      });

      await app.request("/error");
    } finally {
      restore();
      process.env.NODE_ENV = originalEnv;
    }

    expect(calls.length).toBeGreaterThan(0);
  });

  test("logs 4xx warnings", async () => {
    const { calls, restore } = captureConsole();

    try {
      const app = new Hono();
      app.use("*", httpMiddleware({ logger: mockLogger }));
      app.get("/not-found", () => {
        return new Response("not found", { status: 404 });
      });

      await app.request("/not-found");
    } finally {
      restore();
    }

    const warnCalls = calls.filter((c) => c[0] === "warn");
    expect(warnCalls.length).toBeGreaterThan(0);
  });

  test("logs success for 2xx status", async () => {
    const { calls, restore } = captureConsole();

    try {
      const app = new Hono();
      app.use("*", httpMiddleware({ logger: mockLogger }));
      app.get("/success", () => {
        return new Response("ok", { status: 200 });
      });

      await app.request("/success");
    } finally {
      restore();
    }

    expect(calls.length).toBeGreaterThan(0);
  });

  test("adds x-request-id header to response", async () => {
    const app = new Hono();
    app.use("*", httpMiddleware({ logger: mockLogger }));
    app.get("/test", (c) => c.json({}));

    const response = await app.request("/test", {
      headers: { "x-request-id": "test-header-123" },
    });

    expect(response.headers.get("x-request-id")).toBe("test-header-123");
  });

  test("getRequestId returns requestId from context", async () => {
    const { getRequestId } = await import("../middleware/http");
    const app = new Hono();
    app.use("*", httpMiddleware({ logger: mockLogger }));
    app.get("/test", (c) => {
      const id = getRequestId(c);
      return c.json({ requestId: id });
    });

    const response = await app.request("/test", {
      headers: { "x-request-id": "get-test-123" },
    });

    expect(await response.json()).toEqual({ requestId: "get-test-123" });
  });

  test("getLogger returns logger from context", async () => {
    const { getLogger } = await import("../middleware/http");
    const app = new Hono();
    app.use("*", httpMiddleware({ logger: mockLogger }));
    app.get("/test", (c) => {
      const logger = getLogger(c);
      return c.json({ hasLogger: typeof logger === "object" });
    });

    const response = await app.request("/test");
    expect(await response.json()).toEqual({ hasLogger: true });
  });
});
