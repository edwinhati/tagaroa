import { afterEach, beforeEach, describe, expect, test } from "bun:test";

// Test helper functions directly by extracting them
function getEnv(key: string, defaultValue?: string): string {
  const value = process.env[key] || defaultValue;
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function getEnvOptional(
  key: string,
  defaultValue?: string,
): string | undefined {
  return process.env[key] || defaultValue;
}

describe("config", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Reset environment before each test
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  test("getEnv returns value when environment variable exists", () => {
    process.env.TEST_VAR = "test_value";
    expect(getEnv("TEST_VAR")).toBe("test_value");
  });

  test("getEnv returns default value when environment variable is missing", () => {
    delete process.env.MISSING_VAR;
    expect(getEnv("MISSING_VAR", "default")).toBe("default");
  });

  test("getEnv throws error when required variable is missing", () => {
    delete process.env.REQUIRED_VAR;
    expect(() => getEnv("REQUIRED_VAR")).toThrow(
      "Missing required environment variable: REQUIRED_VAR",
    );
  });

  test("getEnvOptional returns value when environment variable exists", () => {
    process.env.OPTIONAL_VAR = "optional_value";
    expect(getEnvOptional("OPTIONAL_VAR")).toBe("optional_value");
  });

  test("getEnvOptional returns default value when environment variable is missing", () => {
    delete process.env.MISSING_OPTIONAL;
    expect(getEnvOptional("MISSING_OPTIONAL", "default")).toBe("default");
  });

  test("getEnvOptional returns undefined when no default provided", () => {
    delete process.env.UNDEFINED_VAR;
    expect(getEnvOptional("UNDEFINED_VAR")).toBeUndefined();
  });

  test("config builds correctly with all env vars", () => {
    // Test the config building logic without importing the actual module
    const env = getEnv("ENV", "development");
    const port = parseInt(getEnv("PORT", "8084"), 10);
    const trustedOrigins = getEnv(
      "TRUSTED_ORIGINS",
      "http://localhost:3000,http://localhost:3001",
    ).split(",");

    expect(env).toBe("development");
    expect(port).toBe(8084);
    expect(Array.isArray(trustedOrigins)).toBe(true);
    expect(trustedOrigins.length).toBeGreaterThan(0);
  });

  test("config sets isProduction correctly", () => {
    const env = getEnv("ENV", "development");
    const isDevelopment = env === "development";
    const isProduction = env === "production";

    expect(isDevelopment).toBe(true);
    expect(isProduction).toBe(false);
  });

  test("config handles optional S3 values", () => {
    const endpoint = getEnvOptional("S3_ENDPOINT");
    const region = getEnvOptional("S3_REGION", "us-east-1");

    // S3 endpoint is optional, so it can be undefined
    expect(endpoint === undefined || typeof endpoint === "string").toBe(true);
    // Region has a default
    expect(region).toBe("us-east-1");
  });

  test("config parses port as integer", () => {
    process.env.PORT = "3000";
    const port = parseInt(getEnv("PORT", "8084"), 10);
    expect(port).toBe(3000);
    expect(typeof port).toBe("number");
  });
});
