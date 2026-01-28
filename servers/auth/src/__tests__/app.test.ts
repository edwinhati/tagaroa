import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  mock,
  test,
} from "bun:test";
import { config } from "../config";

const handlerMock = mock(async () => new Response("handled"));
const suppressedLogPatterns = [
  "[req:failing-request] Auth handler failed",
  "Error: unexpected failure",
];
const ESC = String.fromCharCode(27);
const ansiEscapePattern = new RegExp(`${ESC}\\[[0-9;]*m`, "g");

const originalConsoleLog = console.log;

beforeAll(() => {
  console.log = (...args: unknown[]) => {
    const serialized = args
      .map((arg) => (typeof arg === "string" ? arg : ""))
      .join(" ");
    const normalized = serialized.replaceAll(ansiEscapePattern, "");

    if (suppressedLogPatterns.some((pattern) => normalized.includes(pattern))) {
      return;
    }

    originalConsoleLog(...args);
  };
});

afterAll(() => {
  console.log = originalConsoleLog;
});

mock.module("../auth", () => ({
  auth: { handler: handlerMock },
  trustedOrigins: ["https://trusted.example.com"],
}));

const { createApp } = await import("../app");

describe("auth server app", () => {
  beforeEach(() => {
    handlerMock.mockReset();
    handlerMock.mockImplementation(
      async () => new Response("handled", { status: 200 }),
    );
  });

  test("routes auth requests through the better-auth handler", async () => {
    const { app } = createApp();
    const response = await app.request("/api/auth/session", { method: "GET" });

    expect(handlerMock).toHaveBeenCalledTimes(1);
    const [receivedRequest] = handlerMock.mock.calls[0] ?? [];
    expect(receivedRequest).toBeInstanceOf(Request);
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("handled");
  });

  test("generates a request id when one is not provided", async () => {
    handlerMock.mockImplementation(
      async () => new Response(null, { status: 204 }),
    );
    const { app } = createApp();
    const response = await app.request("/api/auth/ping", { method: "GET" });

    const requestId = response.headers.get("x-request-id");
    expect(requestId).toBeTruthy();
    expect(requestId).not.toBe("");
  });

  test("echoes an incoming request id header", async () => {
    const { app } = createApp();
    const response = await app.request("/api/auth/ping", {
      method: "GET",
      headers: { "x-request-id": "test-id-123" },
    });

    expect(response.headers.get("x-request-id")).toBe("test-id-123");
  });

  test("applies CORS headers for trusted origins", async () => {
    const { app } = createApp();
    const response = await app.request("/api/auth/session", {
      method: "GET",
      headers: { Origin: "https://trusted.example.com" },
    });

    expect(response.headers.get("access-control-allow-origin")).toBe(
      "https://trusted.example.com",
    );
  });

  test("allows localhost origins when running in development", async () => {
    const { app } = createApp();
    const response = await app.request("/api/auth/session", {
      method: "GET",
      headers: { Origin: "http://localhost:5173" },
    });

    expect(response.headers.get("access-control-allow-origin")).toBe(
      "http://localhost:5173",
    );
  });

  test("omits CORS headers for untrusted origins", async () => {
    const { app } = createApp();
    const response = await app.request("/api/auth/session", {
      method: "GET",
      headers: { Origin: "https://evil.example.com" },
    });

    expect(response.headers.get("access-control-allow-origin")).toBeNull();
  });

  test("responds to preflight requests without calling the auth handler", async () => {
    const { app } = createApp();
    const response = await app.request("/api/auth/session", {
      method: "OPTIONS",
      headers: {
        Origin: "https://trusted.example.com",
        "Access-Control-Request-Method": "POST",
      },
    });

    expect(handlerMock).not.toHaveBeenCalled();
    expect(response.status).toBe(204);
    expect(response.headers.get("access-control-allow-origin")).toBe(
      "https://trusted.example.com",
    );
  });

  test("logs failures and returns 500 when the auth handler throws", async () => {
    handlerMock.mockImplementation(() => {
      throw new Error("unexpected failure");
    });

    const { app } = createApp();
    const response = await app.request("/api/auth/session", {
      method: "GET",
      headers: { "x-request-id": "failing-request" },
    });

    expect(response.status).toBe(500);
    expect(response.headers.get("x-request-id")).toBe("failing-request");
  });

  test("returns opaque 500 responses in production mode", async () => {
    handlerMock.mockImplementation(() => {
      throw new Error("unexpected failure");
    });

    const mutableConfig = config as { nodeEnv: typeof config.nodeEnv };
    const originalEnv = config.nodeEnv;
    mutableConfig.nodeEnv = "production";

    try {
      const { app } = createApp();
      const response = await app.request("/api/auth/session", {
        method: "GET",
        headers: { "x-request-id": "prod-request" },
      });

      expect(response.status).toBe(500);
      expect(response.headers.get("x-request-id")).toBe("prod-request");
      expect(response.headers.get("content-type")).toBeNull();
      expect(await response.text()).toBe("");
    } finally {
      mutableConfig.nodeEnv = originalEnv;
    }
  });
});
