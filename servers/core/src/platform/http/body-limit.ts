import type { IncomingMessage, ServerResponse } from "node:http";

/**
 * The largest request body core accepts: 10 MB, what the web proxy enforced
 * before Pangolin sent `/api` straight here.
 *
 * Express's own parsers cap the routes they read. Better Auth reads `/api/auth`
 * itself, with no cap, so a body there must also declare its length: browsers
 * always do, and Node never delivers more than a declared length.
 */
export const MAX_BODY_BYTES = 10 * 1024 * 1024;

export function bodyLimit(
  request: IncomingMessage,
  response: ServerResponse,
  next: () => void,
): void {
  const length = request.headers["content-length"];
  const status =
    length !== undefined && Number(length) > MAX_BODY_BYTES
      ? 413
      : length === undefined &&
          request.headers["transfer-encoding"] !== undefined &&
          (request.url ?? "").startsWith("/api/auth")
        ? 411
        : undefined;
  if (status === undefined) {
    next();
    return;
  }
  // The body is never read, so the connection cannot be reused.
  response.statusCode = status;
  response.setHeader("connection", "close");
  response.end();
}
