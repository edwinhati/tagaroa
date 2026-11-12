import { afterAll, describe, expect, test } from "bun:test";

import { postSignInTarget } from "./auth-client";

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
