import type { IncomingMessage } from "node:http";

import { minutes, type ThrottlerModuleOptions } from "@nestjs/throttler";
import { getIP } from "better-auth/api";
import { fromNodeHeaders } from "better-auth/node";

/** Where a client's address is read from, and which hops in front of it are ours. */
export const ipAddressOptions = (trustedProxies: readonly string[]) => ({
  ipAddressHeaders: ["x-forwarded-for"],
  trustedProxies: [...trustedProxies],
});

/**
 * The client behind Pangolin and Caddy, found the way Better Auth's limiter
 * finds it, so both limits count the same person. Without the trusted hops
 * every client would share the proxy's bucket. A request that carries no
 * forwarded address is counted by its connection.
 */
export const clientAddress = (
  request: IncomingMessage,
  trustedProxies: readonly string[],
): string =>
  getIP(fromNodeHeaders(request.headers), {
    advanced: { ipAddress: ipAddressOptions(trustedProxies) },
  }) ??
  request.socket.remoteAddress ??
  "unknown";

/**
 * Requests one client may make to core's own routes in a minute. Better Auth's
 * routes are mounted outside Nest and keep their own limiter. Webhooks are
 * public, and a provider that is refused retries, so they get less.
 */
export const RATE_LIMITS = { default: 600, webhooks: 120 } as const;

export const WEBHOOK_RATE_LIMIT = {
  default: { limit: RATE_LIMITS.webhooks, ttl: minutes(1) },
};

// ponytail: counts in this process's memory, so each core instance limits on
// its own. Give the module Redis storage if core runs as more than one.
export const rateLimitOptions = ({
  nodeEnv,
  trustedProxies,
}: {
  nodeEnv: string;
  trustedProxies: readonly string[];
}): ThrottlerModuleOptions => ({
  errorMessage: "Too many requests. Wait a minute and try again.",
  getTracker: (request) =>
    clientAddress(request as IncomingMessage, trustedProxies),
  // Off in tests, as Better Auth's limiter is: every test shares one address.
  skipIf: () => nodeEnv === "test",
  throttlers: [{ limit: RATE_LIMITS.default, ttl: minutes(1) }],
});
