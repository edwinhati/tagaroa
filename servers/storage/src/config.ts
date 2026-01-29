export interface Config {
  port: number;
  env: string;
  logLevel: string;
  isDevelopment: boolean;
  isProduction: boolean;

  databaseUrl: string;

  s3: {
    accessKeyId: string;
    secretAccessKey: string;
    bucket: string;
    endpoint?: string;
    region?: string;
  };

  cors: {
    origin: string | string[];
    credentials?: boolean;
  };
}

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

function parseTrustedOrigins(value: string): string | string[] {
  const trimmed = value.trim();
  if (!trimmed) {
    return [];
  }
  const origins = trimmed.split(",").map((o) => o.trim());
  return origins.length === 1 ? origins[0] : origins;
}

const rawEnv = getEnv("ENV", "development");

export const config: Config = {
  port: Number.parseInt(getEnv("PORT", "8084"), 10),
  env: rawEnv,
  logLevel: getEnvOptional("LOG_LEVEL", "info") ?? "info",
  isDevelopment: rawEnv !== "production",
  isProduction: rawEnv === "production",

  databaseUrl: getEnv("DATABASE_URL"),

  s3: {
    accessKeyId: getEnv("S3_ACCESS_KEY_ID"),
    secretAccessKey: getEnv("S3_SECRET_ACCESS_KEY"),
    bucket: getEnv("S3_BUCKET"),
    endpoint: getEnvOptional("S3_ENDPOINT"),
    region: getEnvOptional("S3_REGION", "us-east-1"),
  },

  cors: {
    origin: parseTrustedOrigins(getEnv("TRUSTED_ORIGINS", "*")),
    credentials: true,
  },
};

export const isDevelopment = config.isDevelopment;
export const isProduction = config.isProduction;
export const logLevel = config.logLevel;
