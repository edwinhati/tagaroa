export interface AppEnv {
  BETTER_AUTH_SECRET: string;
  BETTER_AUTH_URL: string;
  DATABASE_URL: string;
  NODE_ENV: "development" | "production" | "test";
  PORT: number;
  TRUSTED_ORIGINS: string[];
  /** One or more browser origins allowed for WebAuthn (door + workspace). */
  PASSKEY_ORIGINS: string[];
  PASSKEY_RP_ID: string;

  /** Whether this process drains the notification queue. */
  NOTIFICATION_WORKER: boolean;
  NOTIFICATION_DEFAULT_LOCALE: string;
  NOTIFICATION_MAX_ATTEMPTS: number;
  NOTIFICATION_POLL_MS: number;
  NOTIFICATION_BATCH_SIZE: number;
  /** Public base URL of the provider webhooks; Twilio signs the URL it was given. */
  NOTIFICATION_WEBHOOK_URL: string;

  // Providers. Every one is optional: outside production nothing is sent to a
  // third party, so the repo runs with none of them set.
  RESEND_API_KEY?: string;
  RESEND_FROM?: string;
  RESEND_WEBHOOK_SECRET?: string;
  TWILIO_ACCOUNT_SID?: string;
  TWILIO_AUTH_TOKEN?: string;
  TWILIO_FROM?: string;
  WHATSAPP_PHONE_NUMBER_ID?: string;
  WHATSAPP_TOKEN?: string;
  WHATSAPP_API_VERSION: string;
  WHATSAPP_APP_SECRET?: string;
  WHATSAPP_VERIFY_TOKEN?: string;
}

const required = (config: Record<string, unknown>, key: string): string => {
  const value = config[key];
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${key} is required`);
  }
  return value;
};

const optional = (
  config: Record<string, unknown>,
  key: string,
): string | undefined => {
  const value = config[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
};

const positiveInteger = (
  config: Record<string, unknown>,
  key: string,
  fallback: number,
): number => {
  const value = Number(config[key] ?? fallback);
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`${key} must be a positive integer`);
  }
  return value;
};

/**
 * A channel is configured or it is not. Half of it — a Resend key with no from
 * address — passes startup and fails at the one moment a message matters.
 */
const allOrNothing = (
  config: Record<string, unknown>,
  keys: readonly string[],
): void => {
  const set = keys.filter((key) => optional(config, key) !== undefined);
  if (set.length > 0 && set.length < keys.length) {
    throw new Error(`${keys.join(", ")} must be set together`);
  }
};

const validUrl = (value: string, key: string): string => {
  try {
    return new URL(value).toString().replace(/\/$/, "");
  } catch {
    throw new Error(`${key} must be a valid URL`);
  }
};

export const validateEnv = (config: Record<string, unknown>): AppEnv => {
  const databaseUrl = validUrl(
    required(config, "DATABASE_URL"),
    "DATABASE_URL",
  );
  if (
    !databaseUrl.startsWith("postgres://") &&
    !databaseUrl.startsWith("postgresql://")
  ) {
    throw new Error("DATABASE_URL must use PostgreSQL");
  }

  const secret = required(config, "BETTER_AUTH_SECRET");
  if (secret.length < 32) {
    throw new Error("BETTER_AUTH_SECRET must be at least 32 characters");
  }

  const nodeEnv = config.NODE_ENV ?? "development";
  if (!["development", "production", "test"].includes(String(nodeEnv))) {
    throw new Error("NODE_ENV must be development, production, or test");
  }

  const port = Number(config.PORT ?? 8080);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error("PORT must be an integer between 1 and 65535");
  }

  const authUrl = validUrl(
    required(config, "BETTER_AUTH_URL"),
    "BETTER_AUTH_URL",
  );
  const trustedOrigins = String(config.TRUSTED_ORIGINS ?? authUrl)
    .split(",")
    .map((origin) => validUrl(origin.trim(), "TRUSTED_ORIGINS"));
  // WebAuthn origin(s). Account settings registers on the workspace; sign-in
  // asserts on the door. A single pinned door origin would reject workspace.
  // PASSKEY_ORIGINS wins; PASSKEY_ORIGIN alone is merged with local workspace
  // defaults so an old door-only .env still allows Account settings.
  const defaultPasskeyOrigins =
    "http://localhost:3000,http://localhost:3001,http://localhost:3002";
  const passkeyOriginsRaw =
    optional(config, "PASSKEY_ORIGINS") ??
    (optional(config, "PASSKEY_ORIGIN")
      ? nodeEnv === "production"
        ? optional(config, "PASSKEY_ORIGIN")!
        : `${optional(config, "PASSKEY_ORIGIN")},${defaultPasskeyOrigins}`
      : defaultPasskeyOrigins);
  const passkeyOrigins = [
    ...new Set(
      String(passkeyOriginsRaw)
        .split(",")
        .map((origin) => origin.trim())
        .filter(Boolean)
        .map((origin) => validUrl(origin, "PASSKEY_ORIGINS")),
    ),
  ];
  if (passkeyOrigins.length === 0) {
    throw new Error("PASSKEY_ORIGINS must list at least one browser origin.");
  }
  const passkeyRpId =
    optional(config, "PASSKEY_RP_ID") ?? new URL(passkeyOrigins[0]!).hostname;

  if (nodeEnv === "production") {
    required(config, "TRUSTED_ORIGINS");
    if (
      !optional(config, "PASSKEY_ORIGINS") &&
      !optional(config, "PASSKEY_ORIGIN")
    ) {
      throw new Error("PASSKEY_ORIGINS is required in production");
    }
    required(config, "PASSKEY_RP_ID");
    const auth = new URL(authUrl);
    if (auth.protocol !== "https:" || auth.username || auth.password) {
      throw new Error(
        "BETTER_AUTH_URL must use HTTPS without credentials in production",
      );
    }
    for (const [key, origins] of [
      ["TRUSTED_ORIGINS", trustedOrigins],
      ["PASSKEY_ORIGINS", passkeyOrigins],
    ] as const) {
      for (const origin of origins) {
        const url = new URL(origin);
        if (
          url.protocol !== "https:" ||
          origin !== url.origin ||
          url.hostname.includes("*")
        ) {
          throw new Error(
            `${key} must contain exact HTTPS origins in production`,
          );
        }
      }
    }
    for (const origin of passkeyOrigins) {
      const hostname = new URL(origin).hostname;
      if (
        !trustedOrigins.includes(origin) ||
        passkeyRpId === "localhost" ||
        !passkeyRpId.includes(".") ||
        !(hostname === passkeyRpId || hostname.endsWith(`.${passkeyRpId}`))
      ) {
        throw new Error(
          "PASSKEY_ORIGINS must be trusted origins within PASSKEY_RP_ID in production",
        );
      }
    }
  }

  allOrNothing(config, ["RESEND_API_KEY", "RESEND_FROM"]);
  allOrNothing(config, [
    "TWILIO_ACCOUNT_SID",
    "TWILIO_AUTH_TOKEN",
    "TWILIO_FROM",
  ]);
  allOrNothing(config, ["WHATSAPP_PHONE_NUMBER_ID", "WHATSAPP_TOKEN"]);

  return {
    BETTER_AUTH_SECRET: secret,
    BETTER_AUTH_URL: authUrl,
    DATABASE_URL: databaseUrl,
    NODE_ENV: nodeEnv as AppEnv["NODE_ENV"],
    PORT: port,
    TRUSTED_ORIGINS: trustedOrigins,
    PASSKEY_ORIGINS: passkeyOrigins,
    PASSKEY_RP_ID: passkeyRpId,

    NOTIFICATION_BATCH_SIZE: positiveInteger(
      config,
      "NOTIFICATION_BATCH_SIZE",
      20,
    ),
    NOTIFICATION_DEFAULT_LOCALE:
      optional(config, "NOTIFICATION_DEFAULT_LOCALE") ?? "en",
    NOTIFICATION_MAX_ATTEMPTS: positiveInteger(
      config,
      "NOTIFICATION_MAX_ATTEMPTS",
      5,
    ),
    NOTIFICATION_POLL_MS: positiveInteger(config, "NOTIFICATION_POLL_MS", 2000),
    NOTIFICATION_WEBHOOK_URL: validUrl(
      String(
        config.NOTIFICATION_WEBHOOK_URL ??
          `${authUrl}/api/notifications/webhooks`,
      ),
      "NOTIFICATION_WEBHOOK_URL",
    ),
    NOTIFICATION_WORKER: String(config.NOTIFICATION_WORKER ?? "1") !== "0",

    RESEND_API_KEY: optional(config, "RESEND_API_KEY"),
    RESEND_FROM: optional(config, "RESEND_FROM"),
    RESEND_WEBHOOK_SECRET: optional(config, "RESEND_WEBHOOK_SECRET"),
    TWILIO_ACCOUNT_SID: optional(config, "TWILIO_ACCOUNT_SID"),
    TWILIO_AUTH_TOKEN: optional(config, "TWILIO_AUTH_TOKEN"),
    TWILIO_FROM: optional(config, "TWILIO_FROM"),
    WHATSAPP_API_VERSION: optional(config, "WHATSAPP_API_VERSION") ?? "v21.0",
    WHATSAPP_APP_SECRET: optional(config, "WHATSAPP_APP_SECRET"),
    WHATSAPP_PHONE_NUMBER_ID: optional(config, "WHATSAPP_PHONE_NUMBER_ID"),
    WHATSAPP_TOKEN: optional(config, "WHATSAPP_TOKEN"),
    WHATSAPP_VERIFY_TOKEN: optional(config, "WHATSAPP_VERIFY_TOKEN"),
  };
};
