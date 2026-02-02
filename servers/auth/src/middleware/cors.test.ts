import { beforeEach, describe, expect, mock, test } from "bun:test";

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

// Import cors after mocks are set up
let corsModule: typeof import("./cors");

beforeEach(async () => {
  configMock.nodeEnv = "development";
  // Clear require cache to get fresh module state
  delete require.cache[require.resolve("./cors")];
  delete require.cache[require.resolve("../auth/configuration")];
  corsModule = await import("./cors");
});

describe("isLocalhost", () => {
  test("returns true for localhost without protocol", () => {
    expect(corsModule.isLocalhost("localhost")).toBe(true);
  });

  test("returns true for localhost with HTTP protocol", () => {
    expect(corsModule.isLocalhost("http://localhost")).toBe(true);
  });

  test("returns true for localhost with HTTPS protocol", () => {
    expect(corsModule.isLocalhost("https://localhost")).toBe(true);
  });

  test("returns true for localhost with port", () => {
    expect(corsModule.isLocalhost("localhost:3000")).toBe(true);
    expect(corsModule.isLocalhost("http://localhost:3000")).toBe(true);
    expect(corsModule.isLocalhost("https://localhost:8080")).toBe(true);
  });

  test("returns true for 127.0.0.1 without protocol", () => {
    expect(corsModule.isLocalhost("127.0.0.1")).toBe(true);
  });

  test("returns true for 127.0.0.1 with HTTP protocol", () => {
    expect(corsModule.isLocalhost("http://127.0.0.1")).toBe(true);
  });

  test("returns true for 127.0.0.1 with port", () => {
    expect(corsModule.isLocalhost("127.0.0.1:3000")).toBe(true);
    expect(corsModule.isLocalhost("http://127.0.0.1:8080")).toBe(true);
  });

  test("returns false for non-localhost origins", () => {
    expect(corsModule.isLocalhost("https://example.com")).toBe(false);
    expect(corsModule.isLocalhost("http://app.example.com:3000")).toBe(false);
    expect(corsModule.isLocalhost("https://192.168.1.1")).toBe(false);
  });
});

describe("corsOriginHandler", () => {
  beforeEach(() => {
    process.env.TRUSTED_ORIGINS = "";
    configMock.nodeEnv = "development";
  });

  test("returns wildcard when origin is undefined", () => {
    expect(corsModule.corsOriginHandler(undefined)).toBe("*");
  });

  test("returns origin for localhost in development mode", () => {
    configMock.nodeEnv = "development";
    expect(corsModule.corsOriginHandler("http://localhost:3000")).toBe(
      "http://localhost:3000",
    );
    expect(corsModule.corsOriginHandler("https://localhost:3000")).toBe(
      "https://localhost:3000",
    );
    expect(corsModule.corsOriginHandler("http://127.0.0.1:3000")).toBe(
      "http://127.0.0.1:3000",
    );
  });

  test("returns null for localhost in production mode", () => {
    configMock.nodeEnv = "production";
    expect(corsModule.corsOriginHandler("http://localhost:3000")).toBeNull();
    expect(corsModule.corsOriginHandler("https://localhost:3000")).toBeNull();
    expect(corsModule.corsOriginHandler("http://127.0.0.1:3000")).toBeNull();
  });

  test("returns null for untrusted origin in development mode", () => {
    configMock.nodeEnv = "development";
    expect(corsModule.corsOriginHandler("https://untrusted.com")).toBeNull();
  });

  test("returns null for untrusted origin in production mode", () => {
    configMock.nodeEnv = "production";
    expect(corsModule.corsOriginHandler("https://untrusted.com")).toBeNull();
  });
});

describe("corsOriginHandler with trusted origins", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  test("returns origin when it is in trusted origins in development", async () => {
    configMock.nodeEnv = "development";
    process.env.TRUSTED_ORIGINS = "https://trusted.example.com";
    delete require.cache[require.resolve("./cors")];
    delete require.cache[require.resolve("../auth/configuration")];
    const freshModule = await import("./cors");
    expect(freshModule.corsOriginHandler("https://trusted.example.com")).toBe(
      "https://trusted.example.com",
    );
  });

  test("returns origin for trusted origin in production mode", async () => {
    configMock.nodeEnv = "production";
    process.env.TRUSTED_ORIGINS = "https://trusted.example.com";
    delete require.cache[require.resolve("./cors")];
    delete require.cache[require.resolve("../auth/configuration")];
    const freshModule = await import("./cors");
    expect(freshModule.corsOriginHandler("https://trusted.example.com")).toBe(
      "https://trusted.example.com",
    );
  });

  test("handles multiple trusted origins", async () => {
    configMock.nodeEnv = "development";
    process.env.TRUSTED_ORIGINS =
      "https://first.example.com,https://second.example.com";
    delete require.cache[require.resolve("./cors")];
    delete require.cache[require.resolve("../auth/configuration")];
    const freshModule = await import("./cors");
    expect(freshModule.corsOriginHandler("https://first.example.com")).toBe(
      "https://first.example.com",
    );
    expect(freshModule.corsOriginHandler("https://second.example.com")).toBe(
      "https://second.example.com",
    );
    expect(
      freshModule.corsOriginHandler("https://third.example.com"),
    ).toBeNull();
  });
});
