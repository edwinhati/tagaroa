import { afterAll, describe, expect, test } from "bun:test";

import { attemptAuth, postSignInTarget } from "./auth-client";

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
  // Cleared rather than inherited from .env, so the fallback these tests assert
  // is the built-in one and not whatever this machine points at.
  delete process.env.VITE_POST_SIGNIN_URL;

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

  test("falls back for missing, untrusted, or invalid redirects", () => {
    expect(postSignInTarget()).toBe("/");
    expect(postSignInTarget("https://example.com/workspace")).toBe("/");
    expect(postSignInTarget("http://[")).toBe("/");
  });
});

describe("attemptAuth", () => {
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
