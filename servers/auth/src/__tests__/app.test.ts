import { mock } from "bun:test";

const handlerMock = mock(async () => new Response("handled"));
const suppressedLogPatterns = [
  "[req:failing-request] Auth handler failed",
  "Error: unexpected failure",
];
const ESC = String.fromCharCode(27);
const ansiEscapePattern = new RegExp(`${ESC}\\[[0-9;]*m`, "g");

const originalConsoleLog = console.log;

mock.module("../db/client", () => ({
  getDatabase: () => ({}),
  db: {},
  schema: {},
}));

mock.module("../auth", () => ({
  auth: { handler: handlerMock },
  trustedOrigins: ["https://trusted.example.com"],
}));

import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
} from "bun:test";

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

import { createApp } from "../app";

describe("auth server app", () => {
  beforeEach(() => {
    handlerMock.mockReset();
    handlerMock.mockImplementation(async () => new Response("handled"));
  });

  test("routes auth requests through the better-auth handler", async () => {
    const { app } = createApp();
    const response = await app.request("/api/auth/session", { method: "GET" });

    expect(handlerMock).toHaveBeenCalledTimes(1);
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("handled");
  });

  test("generates a request id when one is not provided", async () => {
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
});
