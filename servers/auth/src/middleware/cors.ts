import { cors } from "hono/cors";
import { trustedOrigins } from "../auth/configuration";
import { config } from "../config";

const trusted = new Set(trustedOrigins);

const isLocalhost = (origin: string): boolean =>
  /^(https?:\/\/)?(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);

const corsOriginHandler = (origin: string | undefined): string | null => {
  if (!origin) return "*";
  if (trusted.has(origin)) return origin;
  if (config.isDevelopment && isLocalhost(origin)) return origin;
  return null;
};

export const corsMiddleware = cors({
  origin: corsOriginHandler,
  allowHeaders: [
    "Content-Type",
    "Authorization",
    "X-Requested-With",
    "Accept",
    "Origin",
    "Cache-Control",
    "X-File-Name",
  ],
  allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
  exposeHeaders: ["Content-Length", "X-Request-ID"],
  maxAge: 86400,
  credentials: true,
});
