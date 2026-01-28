export interface Config {
  port: number;
  env: string;
  isDevelopment: boolean;
  isProduction: boolean;

  // Database
  databaseUrl: string;

  // S3
  s3: {
    accessKeyId: string;
    secretAccessKey: string;
    bucket: string;
    endpoint?: string;
    region?: string;
  };

  // CORS
  trustedOrigins: string[];
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

export const config: Config = {
  port: Number.parseInt(getEnv("PORT", "8084"), 10),
  env: getEnv("ENV", "development"),
  isDevelopment: getEnv("ENV", "development") === "development",
  isProduction: getEnv("ENV", "development") === "production",

  databaseUrl: getEnv("DATABASE_URL"),

  s3: {
    accessKeyId: getEnv("S3_ACCESS_KEY_ID"),
    secretAccessKey: getEnv("S3_SECRET_ACCESS_KEY"),
    bucket: getEnv("S3_BUCKET"),
    endpoint: getEnvOptional("S3_ENDPOINT"),
    region: getEnvOptional("S3_REGION", "us-east-1"),
  },

  trustedOrigins: getEnv("TRUSTED_ORIGINS").split(","),
};
