import type { IncomingHttpHeaders } from "node:http";

export interface WideEvent {
  timestamp: string;
  service: string;
  version: string;
  commit: string;
  region: string;
  instanceId: string;
  requestId: string;
  correlationId?: string;
  method: string;
  path: string;
  ip?: string;
  userAgent?: string;
  referer?: string;
  statusCode?: number;
  durationMs?: number;
  outcome: "success" | "error" | "timeout";
  error?: {
    message: string;
    type: string;
    stack?: string;
  };
  auth?: {
    userId?: string;
    sessionId?: string;
    operation?: string;
    provider?: string;
  };
  business?: Record<string, unknown>;
  environment: string;
}

export const extractClientIp = (
  headers: IncomingHttpHeaders,
): string | undefined => {
  const raw = headers["x-forwarded-for"] as string | undefined;
  if (raw) return raw.split(",")[0].trim();
  return (
    (headers["cf-connecting-ip"] as string | undefined) ||
    (headers["x-real-ip"] as string | undefined) ||
    undefined
  );
};

export const buildRequestContext = (input: {
  requestId: string;
  correlationId?: string;
  method: string;
  path: string;
  headers: IncomingHttpHeaders;
}): Omit<
  WideEvent,
  "statusCode" | "durationMs" | "outcome" | "error" | "auth" | "business"
> => ({
  timestamp: new Date().toISOString(),
  service: "auth-server",
  version: process.env.SERVICE_VERSION || "unknown",
  commit: process.env.GIT_COMMIT || "unknown",
  region: process.env.AWS_REGION || "unknown",
  instanceId: process.env.INSTANCE_ID || "unknown",
  requestId: input.requestId,
  correlationId: input.correlationId,
  method: input.method,
  path: input.path,
  ip: extractClientIp(input.headers),
  userAgent: input.headers["user-agent"] as string | undefined,
  referer: input.headers.referer as string | undefined,
  environment: process.env.NODE_ENV || "development",
});

export const createWideEvent =
  (
    baseContext: Omit<
      WideEvent,
      "statusCode" | "durationMs" | "outcome" | "error"
    >,
  ) =>
  (
    overrides: Partial<
      Pick<
        WideEvent,
        "statusCode" | "durationMs" | "outcome" | "error" | "auth" | "business"
      >
    > = {},
  ): WideEvent => {
    const outcome = overrides.outcome ?? "success";
    return {
      ...baseContext,
      ...overrides,
      outcome,
    };
  };
