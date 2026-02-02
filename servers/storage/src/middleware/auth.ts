import { createHash } from "node:crypto";
import type { Context, MiddlewareHandler } from "hono";
import type { OIDCClient } from "../lib/oidc-client.js";
import type { createLogger } from "../logger.js";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isValidUUID(s: string): boolean {
  return UUID_REGEX.test(s);
}

function generateDeterministicUUID(input: string): string {
  const hash = createHash("sha256").update(input).digest();

  // Set version to 4 (random)
  hash[6] = (hash[6] & 0x0f) | 0x40;
  // Set variant to RFC 4122
  hash[8] = (hash[8] & 0x3f) | 0x80;

  const hex = hash.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

interface AuthError {
  status: number;
  error: string;
  message: string;
}

function writeAuthError(c: Context, err: AuthError): Response {
  return c.json(
    {
      timestamp: new Date().toISOString(),
      error: err.error,
      message: err.message,
    },
    err.status as 401 | 403 | 500,
  );
}

function extractBearerToken(
  authHeader: string | undefined,
): string | AuthError {
  if (!authHeader) {
    return {
      status: 401,
      error: "Missing authorization header",
      message: "Authorization header is required to access this resource.",
    };
  }

  if (!authHeader.startsWith("Bearer ")) {
    return {
      status: 401,
      error: "Invalid authorization header format",
      message: "Authorization header must be in the format: Bearer <token>.",
    };
  }

  const token = authHeader.slice(7).trim();
  if (!token) {
    return {
      status: 401,
      error: "Invalid authorization header format",
      message: "Authorization header must be in the format: Bearer <token>.",
    };
  }

  return token;
}

export interface AuthMiddlewareOptions {
  oidcClient: OIDCClient;
  logger: ReturnType<typeof createLogger>;
}

export function createAuthMiddleware(
  options: AuthMiddlewareOptions,
): MiddlewareHandler {
  const { oidcClient, logger } = options;

  return async (c, next) => {
    const tokenResult = extractBearerToken(c.req.header("Authorization"));

    if (typeof tokenResult === "object") {
      logger.info(
        `Authentication failed: ${tokenResult.error}`,
        undefined,
        `ip:${c.req.header("x-forwarded-for") || c.req.header("x-real-ip") || "unknown"}`,
      );
      return writeAuthError(c, tokenResult);
    }

    try {
      const subject = await oidcClient.getSubject(tokenResult);

      const userId = isValidUUID(subject)
        ? subject
        : generateDeterministicUUID(subject);

      logger.info(
        `Authentication successful`,
        undefined,
        `user:${userId} path:${c.req.path}`,
      );

      c.set("userId", userId);
      await next();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      logger.info(
        `Authentication failed: ${message}`,
        undefined,
        `path:${c.req.path}`,
      );

      return writeAuthError(c, {
        status: 401,
        error: "Invalid or expired token",
        message,
      });
    }
  };
}
