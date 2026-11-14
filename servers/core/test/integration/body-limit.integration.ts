import { describe, expect, test } from "bun:test";
import { request } from "node:http";

import { MAX_BODY_BYTES } from "../../src/platform/http/body-limit";
import { baseURL, serveCore } from "./harness";

serveCore();

/** Sends only the headers (and a first chunk), so an unchecked body would hang. */
function status(path: string, headers: Record<string, string>, body?: string) {
  const { hostname, port } = new URL(baseURL);
  return new Promise<number>((resolve, reject) => {
    const req = request(
      { host: hostname, port, path, method: "POST", headers },
      (res) => {
        res.resume();
        resolve(res.statusCode ?? 0);
      },
    );
    req.on("error", reject);
    if (body === undefined) req.flushHeaders();
    else req.write(body);
  });
}

describe("request body limit, ahead of Better Auth", () => {
  test("an oversized declared body never reaches /api/auth", async () => {
    expect(
      await status("/api/auth/sign-in/email", {
        "content-type": "application/json",
        "content-length": String(MAX_BODY_BYTES + 1),
      }),
    ).toBe(413);
  });

  test("an undeclared body never reaches /api/auth", async () => {
    expect(
      await status(
        "/api/auth/sign-in/email",
        { "content-type": "application/json", "transfer-encoding": "chunked" },
        "{",
      ),
    ).toBe(411);
  });
});
