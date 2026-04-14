/**
 * Shared Sentry configuration for all Next.js apps
 * Centralizes DSN, environment, and sampling configuration
 */

interface SentryConfig {
  dsn: string | undefined;
  environment: string;
  tracesSampleRate: number;
  profilesSampleRate?: number;
  enabled: boolean;
  debug: boolean;
  tunnel?: string;
}

/**
 * Get Sentry configuration from environment variables
 * Works for both Node.js and browser environments
 */
export function getSentryConfig(): SentryConfig {
  const isDev = getEnvVar("NODE_ENV") === "development";

  const dsn = getEnvVar("NEXT_PUBLIC_SENTRY_DSN") || getEnvVar("SENTRY_DSN");

  const rawTracesRate =
    getEnvVar("NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE") ||
    getEnvVar("SENTRY_TRACES_SAMPLE_RATE");
  const tracesSampleRate = rawTracesRate
    ? Number.parseFloat(rawTracesRate)
    : 0.2;

  const rawProfilesRate =
    getEnvVar("SENTRY_PROFILES_SAMPLE_RATE") ||
    getEnvVar("NEXT_PUBLIC_SENTRY_PROFILES_SAMPLE_RATE");
  const profilesSampleRate = rawProfilesRate
    ? Number.parseFloat(rawProfilesRate)
    : 0;

  const environment =
    getEnvVar("SENTRY_ENVIRONMENT") || getEnvVar("NODE_ENV") || "development";

  const sentryDevEnable = getEnvVar("NEXT_PUBLIC_SENTRY_DEV_ENABLE") === "true";

  const enabled = Boolean(dsn) && (!isDev || sentryDevEnable);

  const debug = getEnvVar("NEXT_PUBLIC_SENTRY_DEBUG") === "true" || false;

  const tunnel = getEnvVar("NEXT_PUBLIC_SENTRY_TUNNEL") || undefined;

  return {
    dsn,
    environment,
    tracesSampleRate: Number.isNaN(tracesSampleRate) ? 0.2 : tracesSampleRate,
    profilesSampleRate: Number.isNaN(profilesSampleRate)
      ? 0
      : profilesSampleRate,
    enabled,
    debug,
    tunnel,
  };
}

/**
 * Universal environment variable getter
 * Works in browser, Node.js, and edge runtimes
 */
function getEnvVar(name: string): string | undefined {
  try {
    if (typeof process !== "undefined" && process.env) {
      return process.env[name];
    }
  } catch {
    // Edge runtime or browser without process
  }

  return undefined;
}

/**
 * Validate Sentry configuration
 */
export function validateSentryConfig(config: SentryConfig): string[] {
  const errors: string[] = [];

  if (!config.dsn) {
    errors.push("Sentry DSN is not configured");
  }

  if (config.tracesSampleRate < 0 || config.tracesSampleRate > 1) {
    errors.push("tracesSampleRate must be between 0 and 1");
  }

  if (
    config.profilesSampleRate !== undefined &&
    (config.profilesSampleRate < 0 || config.profilesSampleRate > 1)
  ) {
    errors.push("profilesSampleRate must be between 0 and 1");
  }

  return errors;
}
