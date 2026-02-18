import { z } from "zod";

export const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  BETTER_AUTH_SECRET: z.string().min(32),
  PORT: z.coerce.number().default(8080),
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  ALLOWED_ORIGINS: z
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
  MAX_FILE_SIZE: z.coerce.number().default(10_485_760),
  S3_PROVIDER: z.enum(["minio", "aws", "r2"]).default("minio"),
  S3_BUCKET: z.string().default("uploads"),
  S3_REGION: z.string().default("us-east-1"),
  S3_ENDPOINT: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().default(""),
  S3_SECRET_ACCESS_KEY: z.string().default(""),
  CLOUDFLARE_ACCOUNT_ID: z.string().optional(),
  BASE_URL: z.string().default("http://localhost"),
});

export type AppConfig = z.infer<typeof envSchema>;
