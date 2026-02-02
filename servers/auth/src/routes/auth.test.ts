import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  mock,
  test,
} from "bun:test";

// Mock config module
type ConfigMock = {
  port: number;
  nodeEnv: "development" | "production";
  logLevel: string;
  readonly isDevelopment: boolean;
  readonly isProduction: boolean;
};

const configMock: ConfigMock = {
  port: 8081,
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

// Mock auth module
const authMock = {
  handler: mock(async () => new Response("auth handled")),
};

mock.module("../auth", () => ({
  auth: authMock,
}));

// Mock db module
mock.module("../db/client", () => ({
  getDatabase: () => ({}),
  db: {},
  schema: {},
}));

import type { Context } from "hono";
import type { Logger } from "../logger";
import { handleAuth } from "../routes/auth";

const originalConsoleLog = console.log;
const ESC = String.fromCharCode(27);
const ansiEscapePattern = new RegExp(`${ESC}\\[[0-9;]*m`, "g");

const suppressedLogPatterns = [
  "[req:test-request-id] Auth handler failed",
  "Error: handler error",
];

beforeAll(() => {
  console.log = (...args: unknown[]) => {
    const serialized = args
      .map((arg) => (typeof arg === "string" ? arg : ""))
      .join(" ");
    const normalized = serialized.replace(ansiEscapePattern, "");

    if (suppressedLogPatterns.some((pattern) => normalized.includes(pattern))) {
      return;
    }

    originalConsoleLog(...args);
  };
});

afterAll(() => {
  console.log = originalConsoleLog;
});

describe("handleAuth", () => {
  beforeEach(() => {
    authMock.handler.mockReset();
    authMock.handler.mockImplementation(
      async () => new Response("auth handled"),
    );
    configMock.nodeEnv = "development";
  });

  test("returns response from auth handler", async () => {
    const context = {
      req: {
        raw: new Request("http://example.com/api/auth/session"),
      },
      get: mock((key: string) => {
        if (key === "requestId") return "test-request-id";
        if (key === "logger") return console;
        return undefined;
      }),
    };

    const response = await handleAuth(context as Context);

    expect(response).toBeInstanceOf(Response);
    expect(await response.text()).toBe("auth handled");
    expect(authMock.handler).toHaveBeenCalledTimes(1);
  });

  test("adds x-request-id header to response when not present", async () => {
    const context = {
      req: {
        raw: new Request("http://example.com/api/auth/session"),
      },
      get: mock((key: string) => {
        if (key === "requestId") return "custom-request-id";
        if (key === "logger") return console;
        return undefined;
      }),
    };

    const response = await handleAuth(context as Context);

    expect(response.headers.get("x-request-id")).toBe("custom-request-id");
  });

  test("does not overwrite existing x-request-id header", async () => {
    authMock.handler.mockImplementation(
      async () =>
        new Response("auth handled", {
          headers: { "x-request-id": "original-id" },
        }),
    );

    const context = {
      req: {
        raw: new Request("http://example.com/api/auth/session"),
      },
      get: mock((key: string) => {
        if (key === "requestId") return "custom-request-id";
        if (key === "logger") return console;
        return undefined;
      }),
    };

    const response = await handleAuth(context as Context);

    expect(response.headers.get("x-request-id")).toBe("original-id");
  });

  test("returns json error response in development when handler throws", async () => {
    authMock.handler.mockImplementation(() => {
      throw new Error("handler error");
    });

    const context = {
      req: {
        raw: new Request("http://example.com/api/auth/session"),
      },
      get: mock((key: string) => {
        if (key === "requestId") return "test-request-id";
        if (key === "logger") return console;
        return undefined;
      }),
    };

    const response = await handleAuth(context as Context);

    expect(response.status).toBe(500);
    expect(response.headers.get("content-type")).toBe("application/json");
    expect(response.headers.get("x-request-id")).toBe("test-request-id");

    const body = await response.json();
    expect(body).toEqual({
      error: "Internal Server Error",
      message: "handler error",
      requestId: "test-request-id",
    });
  });

  test("returns plain error response in production when handler throws", async () => {
    configMock.nodeEnv = "production";
    authMock.handler.mockImplementation(() => {
      throw new Error("handler error");
    });

    const context = {
      req: {
        raw: new Request("http://example.com/api/auth/session"),
      },
      get: mock((key: string) => {
        if (key === "requestId") return "prod-request-id";
        if (key === "logger") return console;
        return undefined;
      }),
    };

    const response = await handleAuth(context as Context);

    expect(response.status).toBe(500);
    expect(response.headers.get("content-type")).toBeNull();
    expect(response.headers.get("x-request-id")).toBe("prod-request-id");
    expect(await response.text()).toBe("");
  });

  test("handles missing requestId gracefully", async () => {
    const context = {
      req: {
        raw: new Request("http://example.com/api/auth/session"),
      },
      get: mock((key: string) => {
        if (key === "logger") return console;
        return undefined;
      }),
    };

    const response = await handleAuth(context as Context);

    expect(response).toBeInstanceOf(Response);
    expect(response.headers.get("x-request-id")).toBeNull();
  });

  test("handles missing logger gracefully", async () => {
    const context = {
      req: {
        raw: new Request("http://example.com/api/auth/session"),
      },
      get: mock(() => undefined),
    };

    const response = await handleAuth(context as Context);

    expect(response).toBeInstanceOf(Response);
  });
});
