import { Logger } from "@nestjs/common";

const REQUIRED_ENV_VARS = ["DATABASE_URL", "BETTER_AUTH_SECRET"] as const;

export function validateEnv(): void {
  const logger = new Logger("EnvValidation");
  const missing: string[] = [];

  for (const key of REQUIRED_ENV_VARS) {
    if (!process.env[key]) {
      missing.push(key);
    }
  }

  if (missing.length > 0) {
    const message = `Missing required environment variables: ${missing.join(", ")}`;
    logger.error(message);
    throw new Error(message);
  }
}
