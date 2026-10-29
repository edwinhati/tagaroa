import { afterAll, describe, expect, test } from "bun:test";

import { attemptAuth, authClient, postSignInTarget } from "./auth-client";

const previousWindow = Object.getOwnPropertyDescriptor(globalThis, "window");

afterAll(() => {
  if (previousWindow)
    Object.defineProperty(globalThis, "window", previousWindow);
  else Reflect.deleteProperty(globalThis, "window");
});

describe("postSignInTarget", () => {
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { location: { origin: "http://localhost:5173" } },
  });
  process.env.VITE_TRUSTED_REDIRECT_ORIGINS =
    "http://localhost:3002, http://localhost:3003";
  // Set here rather than inherited from .env, so the fallback these tests assert
  // is the one they configured and not whatever this machine's door points at.
  process.env.VITE_POST_SIGNIN_URL = "http://localhost:3000";

  test("accepts same-origin redirects", () => {
    expect(postSignInTarget("/workspace")).toBe(
      "http://localhost:5173/workspace",
    );
  });

  test("accepts a redirect to another workspace app", () => {
    expect(postSignInTarget("http://localhost:3003/inbox")).toBe(
      "http://localhost:3003/inbox",
    );
  });

  test("falls back to the workspace for missing, untrusted, or invalid redirects", () => {
    expect(postSignInTarget()).toBe("http://localhost:3000");
    expect(postSignInTarget("https://example.com/workspace")).toBe(
      "http://localhost:3000",
    );
    expect(postSignInTarget("http://[")).toBe("http://localhost:3000");
  });
});

describe("attemptAuth", () => {
  test("a stalled authentication transport aborts and reports a retryable error", async () => {
    let aborted = false;
    const fetch = Object.assign(
      (_input: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener(
            "abort",
            () => {
              aborted = true;
              reject(new DOMException("Timed out", "AbortError"));
            },
            { once: true },
          );
        }),
      { preconnect: globalThis.fetch.preconnect },
    );
    const result = await attemptAuth(
      () =>
        authClient.signIn.email({
          email: "timeout@tagaroa.test",
          password: "timeout-password-12",
          fetchOptions: { customFetchImpl: fetch },
        }),
      "Failed.",
    );
    expect(aborted).toBe(true);
    expect(result.failure).toBe(
      "Can't reach the sign-in service. Try again in a moment.",
    );
  }, 30_000);
  test("passes the data through when the call succeeds", async () => {
    expect(
      await attemptAuth(async () => ({ data: { id: "user" } }), "Failed."),
    ).toEqual({ data: { id: "user" } });
  });

  test("turns the server's own error into a sentence", async () => {
    expect(
      await attemptAuth(
        async () => ({ error: { message: "Wrong password." } }),
        "Failed.",
      ),
    ).toEqual({ failure: "Wrong password." });
  });

  test("turns an unreachable service into a sentence we own", async () => {
    expect(
      await attemptAuth(() => Promise.reject(new Error("offline")), "Failed."),
    ).toEqual({
      failure: "Can't reach the sign-in service. Try again in a moment.",
    });
  });
});
