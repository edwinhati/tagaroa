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
  BETTER_AUTH_URL: "https://company.example",
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
    {
      TRUSTED_ORIGINS:
        "https://auth.company.example,https://work.other.example",
    },
    { BETTER_AUTH_URL: "https://core.company.example" },
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

test("trusts private proxy hops by default and rejects a malformed one", () => {
  expect(validateEnv(production).AUTH_TRUSTED_PROXIES).toContain(
    "172.16.0.0/12",
  );
  expect(
    validateEnv({ ...production, AUTH_TRUSTED_PROXIES: "172.18.0.0/16, ::1" })
      .AUTH_TRUSTED_PROXIES,
  ).toEqual(["172.18.0.0/16", "::1"]);
  for (const AUTH_TRUSTED_PROXIES of [
    "172.18.0.0/33",
    "pangolin",
    "10.0.0.0/8/8",
  ]) {
    expect(() =>
      validateEnv({ ...production, AUTH_TRUSTED_PROXIES }),
    ).toThrow();
  }
});

const development = {
  BETTER_AUTH_SECRET: "a".repeat(32),
  BETTER_AUTH_URL: "http://localhost:8080",
  DATABASE_URL: "postgresql://tagaroa:tagaroa@localhost/tagaroa",
};

test("names the variable and the rule each startup failure broke", () => {
  const failures: [Record<string, unknown>, string][] = [
    [{ DATABASE_URL: undefined }, "DATABASE_URL is required"],
    [{ DATABASE_URL: "" }, "DATABASE_URL is required"],
    [{ DATABASE_URL: "not a url" }, "DATABASE_URL must be a valid URL"],
    [
      { DATABASE_URL: "mysql://localhost/db" },
      "DATABASE_URL must use PostgreSQL",
    ],
    [{ BETTER_AUTH_SECRET: undefined }, "BETTER_AUTH_SECRET is required"],
    [
      { BETTER_AUTH_SECRET: "a".repeat(31) },
      "BETTER_AUTH_SECRET must be at least 32 characters",
    ],
    [
      { NODE_ENV: "staging" },
      "NODE_ENV must be development, production, or test",
    ],
    ...["0", "65536", "80.5", "http", ""].map(
      (PORT): [Record<string, unknown>, string] => [
        { PORT },
        "PORT must be an integer between 1 and 65535",
      ],
    ),
    [{ BETTER_AUTH_URL: undefined }, "BETTER_AUTH_URL is required"],
    [{ BETTER_AUTH_URL: "localhost" }, "BETTER_AUTH_URL must be a valid URL"],
    [
      { TRUSTED_ORIGINS: "http://localhost:3001,nope" },
      "TRUSTED_ORIGINS must be a valid URL",
    ],
    [{ PASSKEY_ORIGINS: "nope" }, "PASSKEY_ORIGINS must be a valid URL"],
    [
      { PASSKEY_ORIGINS: " , " },
      "PASSKEY_ORIGINS must list at least one browser origin.",
    ],
    ...[
      "NOTIFICATION_BATCH_SIZE",
      "NOTIFICATION_MAX_ATTEMPTS",
      "NOTIFICATION_POLL_MS",
    ].flatMap((key) =>
      ["0", "-1", "1.5", "many"].map(
        (value): [Record<string, unknown>, string] => [
          { [key]: value },
          `${key} must be a positive integer`,
        ],
      ),
    ),
    [
      { NOTIFICATION_WEBHOOK_URL: "nope" },
      "NOTIFICATION_WEBHOOK_URL must be a valid URL",
    ],
    [
      { RESEND_API_KEY: "key" },
      "RESEND_API_KEY, RESEND_FROM must be set together",
    ],
    [
      { TWILIO_ACCOUNT_SID: "sid", TWILIO_AUTH_TOKEN: "token" },
      "TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM must be set together",
    ],
    [
      { WHATSAPP_TOKEN: "token" },
      "WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_TOKEN must be set together",
    ],
    [
      {
        FRAPPE_API_KEY: "key",
        FRAPPE_API_SECRET: "secret",
        FRAPPE_URL: "nope",
        FRAPPE_WEBHOOK_SECRET: "s".repeat(32),
      },
      "FRAPPE_URL must be a valid URL",
    ],
  ];

  for (const [override, message] of failures) {
    expect(() => validateEnv({ ...development, ...override })).toThrow(message);
  }
});

test("production names each variable it requires", () => {
  expect(() =>
    validateEnv({ ...production, TRUSTED_ORIGINS: undefined }),
  ).toThrow("TRUSTED_ORIGINS is required");
  expect(() =>
    validateEnv({ ...production, PASSKEY_ORIGINS: undefined }),
  ).toThrow("PASSKEY_ORIGINS is required in production");
  expect(() =>
    validateEnv({ ...production, PASSKEY_RP_ID: undefined }),
  ).toThrow("PASSKEY_RP_ID is required");
});

test("an empty optional variable counts as unset and takes its default", () => {
  const env = validateEnv({
    ...development,
    NOTIFICATION_DEFAULT_LOCALE: "",
    RESEND_API_KEY: "",
    RESEND_FROM: "",
    WHATSAPP_API_VERSION: "",
  });
  expect(env).toMatchObject({
    NODE_ENV: "development",
    NOTIFICATION_BATCH_SIZE: 20,
    NOTIFICATION_DEFAULT_LOCALE: "en",
    NOTIFICATION_MAX_ATTEMPTS: 5,
    NOTIFICATION_POLL_MS: 2000,
    NOTIFICATION_WEBHOOK_URL:
      "http://localhost:8080/api/notifications/webhooks",
    NOTIFICATION_WORKER: true,
    PASSKEY_RP_ID: "localhost",
    TRUSTED_ORIGINS: ["http://localhost:8080"],
    WHATSAPP_API_VERSION: "v21.0",
  });
  expect(env.RESEND_API_KEY).toBeUndefined();
  expect(
    validateEnv({ ...development, NOTIFICATION_WORKER: "0" })
      .NOTIFICATION_WORKER,
  ).toBe(false);
});
