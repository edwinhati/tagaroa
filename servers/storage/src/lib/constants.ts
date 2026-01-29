export const CONSTANTS = {
  SERVER: {
    DEFAULT_PORT: 8080,
    SHUTDOWN_TIMEOUT_MS: 10_000,
  },
  FILES: {
    MAX_FILE_SIZE_MB: 50,
    ALLOWED_CONTENT_TYPES: [
      "image/jpeg",
      "image/png",
      "image/gif",
      "image/webp",
      "application/pdf",
      "text/plain",
      "application/zip",
    ] as const,
    UPLOAD_BATCH_SIZE: 10,
  },
  AWS: {
    S3_PRESIGNED_URL_EXPIRY_SECONDS: 3600,
    MAX_RETRIES: 3,
    RETRY_DELAY_MS: 1000,
  },
  REQUEST: {
    ID_HEADER: "x-request-id",
    CORRELATION_HEADER: "x-correlation-id",
  },
} as const;
