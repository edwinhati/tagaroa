import { z } from "zod";

export const envSchema = z.object({
  DATABASE_URL: z.url(),
  BETTER_AUTH_SECRET: z.string().min(32),
  PORT: z.coerce.number().default(8080),
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  MAX_FILE_SIZE: z.coerce.number().default(10_485_760),
  S3_PROVIDER: z.enum(["minio", "aws", "r2"]).default("minio"),
  S3_BUCKET: z.string().default("uploads"),
  S3_REGION: z.string().default("us-east-1"),
  S3_ENDPOINT: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().default(""),
  S3_SECRET_ACCESS_KEY: z.string().default(""),
  CLOUDFLARE_ACCOUNT_ID: z.string().optional(),
  BASE_URL: z.url().default(""),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  TRUSTED_ORIGINS: z
    .string()
    .optional()
    .transform((s) =>
      s
        ? s
            .split(",")
            .map((o) => o.trim())
            .filter(Boolean)
        : [],
    ),
  // Health check thresholds
  HEALTH_MEMORY_HEAP_THRESHOLD_MB: z.coerce.number().default(512),
  HEALTH_MEMORY_RSS_THRESHOLD_MB: z.coerce.number().default(1024),
  HEALTH_DISK_THRESHOLD_PERCENT: z.coerce.number().min(0).max(1).default(0.8),
  // Sentry configuration
  SENTRY_DSN: z.url().optional(),
  SENTRY_TRACES_SAMPLE_RATE: z.coerce.number().min(0).max(1).default(1),
  SENTRY_ENVIRONMENT: z.string().optional(),
  SENTRY_ENABLED: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
  // Profiling configuration (Bun native)
  PROFILING_ENABLED: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
  PROFILING_INTERVAL_MS: z.coerce.number().default(5000),
  PROFILING_MAX_SAMPLES: z.coerce.number().default(1000),
  // OpenTelemetry configuration
  OTEL_ENABLED: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
  OTEL_EXPORTER_OTLP_ENDPOINT: z.url().optional(),
  OTEL_SERVICE_NAME: z.string().default("tagaroa-core"),
});

export type AppConfig = z.infer<typeof envSchema>;
