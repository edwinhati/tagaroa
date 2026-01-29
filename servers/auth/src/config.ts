interface Config {
  port: number;
  nodeEnv: string;
  logLevel: string;
  isDevelopment: boolean;
  isProduction: boolean;
}

const getEnv = (key: string, defaultValue: string): string =>
  process.env[key] ?? defaultValue;
const getEnvNumber = (key: string, defaultValue: number): number => {
  const value = process.env[key];
  return value ? Number.parseInt(value, 10) : defaultValue;
};

export const config: Config = {
  port: getEnvNumber("PORT", 8080),
  nodeEnv: getEnv("NODE_ENV", "development"),
  logLevel: getEnv("LOG_LEVEL", "info"),

  get isDevelopment() {
    return this.nodeEnv !== "production";
  },

  get isProduction() {
    return this.nodeEnv === "production";
  },
};

export const isDevelopment = config.isDevelopment;
export const isProduction = config.isProduction;
export const logLevel = config.logLevel;
export const port = config.port;
export const nodeEnv = config.nodeEnv;
