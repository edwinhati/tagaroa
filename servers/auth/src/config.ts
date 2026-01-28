export const config = {
  port: process.env.PORT ? Number.parseInt(process.env.PORT, 10) : 8080,
  nodeEnv: process.env.NODE_ENV || "development",
  logLevel: process.env.LOG_LEVEL || "info",

  get isDevelopment() {
    return this.nodeEnv !== "production";
  },

  get isProduction() {
    return this.nodeEnv === "production";
  },
} as const;
