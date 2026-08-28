export interface AppEnv {
  BETTER_AUTH_SECRET: string;
  BETTER_AUTH_URL: string;
  DATABASE_URL: string;
  NODE_ENV: "development" | "production" | "test";
  PORT: number;
  TRUSTED_ORIGINS: string[];
}

const required = (config: Record<string, unknown>, key: string): string => {
  const value = config[key];
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${key} is required`);
  }
  return value;
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

  return {
    BETTER_AUTH_SECRET: secret,
    BETTER_AUTH_URL: authUrl,
    DATABASE_URL: databaseUrl,
    NODE_ENV: nodeEnv as AppEnv["NODE_ENV"],
    PORT: port,
    TRUSTED_ORIGINS: trustedOrigins,
  };
};
