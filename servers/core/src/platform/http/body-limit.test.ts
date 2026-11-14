import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { createServer, request, type Server } from "node:http";
import type { AddressInfo } from "node:net";

import { MAX_BODY_BYTES, bodyLimit } from "./body-limit";

let server: Server;
let port: number;

/** Behind the limit, a handler that reads the whole body the way Better Auth does. */
beforeAll(async () => {
  server = createServer((req, res) =>
    bodyLimit(req, res, () => {
      let bytes = 0;
      req.on("data", (chunk: Buffer) => (bytes += chunk.length));
      req.on("end", () => res.end(String(bytes)));
    }),
  );
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  port = (server.address() as AddressInfo).port;
});

afterAll(() => server.close());

/** Sends headers and an optional first chunk, and resolves with the status. */
function send(path: string, headers: Record<string, string>, body = "") {
  return new Promise<number>((resolve, reject) => {
    const req = request(
      { host: "127.0.0.1", port, path, method: "POST", headers },
      (res) => {
        res.resume();
        resolve(res.statusCode ?? 0);
      },
    );
    req.on("error", reject);
    req.end(body);
  });
}

describe("bodyLimit", () => {
  test("refuses a declared length over the limit before reading it", async () => {
    // The body is never sent: the answer comes from the header alone.
    const status = await new Promise<number>((resolve, reject) => {
      const req = request(
        {
          host: "127.0.0.1",
          port,
          path: "/api/directory/people",
          method: "POST",
          headers: { "content-length": String(MAX_BODY_BYTES + 1) },
        },
        (res) => resolve(res.statusCode ?? 0),
      );
      req.on("error", reject);
      req.flushHeaders();
    });
    expect(status).toBe(413);
  });

  test("refuses a Better Auth body that does not declare its length", async () => {
    expect(
      await send(
        "/api/auth/sign-in/email",
        { "transfer-encoding": "chunked" },
        "{}",
      ),
    ).toBe(411);
  });

  test("lets declared bodies and other chunked routes through", async () => {
    expect(
      await send("/api/auth/sign-in/email", { "content-length": "2" }, "{}"),
    ).toBe(200);
    expect(
      await send(
        "/api/notifications/webhooks/resend",
        { "transfer-encoding": "chunked" },
        "{}",
      ),
    ).toBe(200);
    expect(await send("/api/health/live", {})).toBe(200);
  });
});
