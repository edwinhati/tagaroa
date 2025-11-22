import { cors } from "hono/cors";
import { trustedOrigins } from "../auth";
import { config } from "../config";

const trusted = new Set(trustedOrigins);

const isLocalhost = (origin: string): boolean =>
	/^(https?:\/\/)?(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);

const corsOriginHandler = (origin: string | undefined): string | null => {
	// No Origin header (curl, native apps) — allow via wildcard
	if (!origin) return "*";

	// Exact allowlist
	if (trusted.has(origin)) return origin;

	// Dev: allow localhost
	if (config.isDevelopment && isLocalhost(origin)) {
		return origin;
	}

	// Disallow by returning null (no ACAO header)
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
