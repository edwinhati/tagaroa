import { expect, test } from "bun:test";

import { validateEnv } from "./env";

test("defaults the core service to port 8080", () => {
  const env = validateEnv({
    BETTER_AUTH_SECRET: "a".repeat(32),
    BETTER_AUTH_URL: "http://localhost:8080",
    DATABASE_URL: "postgresql://tagaroa:tagaroa@localhost/tagaroa",
  });

  expect(env.PORT).toBe(8080);
});

const production = {
  NODE_ENV: "production",
  BETTER_AUTH_SECRET: "a".repeat(32),
  BETTER_AUTH_URL: "https://core.company.example",
  DATABASE_URL: "postgresql://tagaroa:tagaroa@localhost/tagaroa",
  TRUSTED_ORIGINS: "https://auth.company.example,https://work.company.example",
  PASSKEY_ORIGINS: "https://auth.company.example,https://work.company.example",
  PASSKEY_RP_ID: "company.example",
};

test("production requires explicit HTTPS origins and a compatible passkey relying party", () => {
  expect(validateEnv(production).PASSKEY_ORIGINS).toEqual([
    "https://auth.company.example",
    "https://work.company.example",
  ]);
  for (const key of ["TRUSTED_ORIGINS", "PASSKEY_ORIGINS", "PASSKEY_RP_ID"]) {
    expect(() => validateEnv({ ...production, [key]: undefined })).toThrow();
  }
  for (const override of [
    { BETTER_AUTH_URL: "http://core.company.example" },
    { BETTER_AUTH_URL: "https://user:password@core.company.example" },
    { TRUSTED_ORIGINS: "http://localhost:3001" },
    { TRUSTED_ORIGINS: "https://*.company.example" },
    { TRUSTED_ORIGINS: "https://auth.company.example/path" },
    { TRUSTED_ORIGINS: "https://auth.company.example?redirect=1" },
    { PASSKEY_ORIGINS: "https://unknown.company.example" },
    { PASSKEY_ORIGINS: "http://localhost:3001" },
    { PASSKEY_RP_ID: "unrelated.example" },
    { PASSKEY_RP_ID: "localhost" },
    { PASSKEY_RP_ID: "example" },
    { PASSKEY_RP_ID: "auth.company.example.evil.example" },
  ]) {
    expect(() => validateEnv({ ...production, ...override })).toThrow();
  }
});

test("production single-origin shorthand never includes development origins", () => {
  const env = validateEnv({
    ...production,
    PASSKEY_ORIGINS: undefined,
    PASSKEY_ORIGIN: "https://auth.company.example",
  });
  expect(env.PASSKEY_ORIGINS).toEqual(["https://auth.company.example"]);
});

test("Frappe HR is all or nothing, with a strong secret and HTTPS in production", () => {
  const frappe = {
    FRAPPE_API_KEY: "key",
    FRAPPE_API_SECRET: "secret",
    FRAPPE_URL: "https://hr.company.example",
    FRAPPE_WEBHOOK_SECRET: "s".repeat(32),
  };
  expect(validateEnv({ ...production, ...frappe }).FRAPPE_URL).toBe(
    "https://hr.company.example",
  );
  expect(() =>
    validateEnv({ ...production, ...frappe, FRAPPE_API_SECRET: undefined }),
  ).toThrow("must be set together");
  expect(() =>
    validateEnv({ ...production, ...frappe, FRAPPE_WEBHOOK_SECRET: "short" }),
  ).toThrow("at least 32 characters");
  expect(() =>
    validateEnv({
      ...production,
      ...frappe,
      FRAPPE_URL: "http://hr.company.example",
    }),
  ).toThrow("HTTPS in production");
});
