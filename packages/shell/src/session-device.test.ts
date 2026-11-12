import { describe, expect, test } from "bun:test";

import { parseUserAgent } from "./session-device";

describe("parseUserAgent", () => {
  test("returns unknown for empty", () => {
    expect(parseUserAgent(null)).toEqual({
      browser: null,
      platform: null,
      label: "Unknown device",
    });
  });

  test("Chrome on macOS", () => {
    const ua =
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
    expect(parseUserAgent(ua)).toEqual({
      browser: "chrome",
      platform: "apple",
      label: "Chrome on macOS",
    });
  });

  test("Safari on iPhone", () => {
    const ua =
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
    expect(parseUserAgent(ua)).toEqual({
      browser: "safari",
      platform: "apple",
      label: "Safari on iPhone",
    });
  });

  test("Chrome on Windows", () => {
    const ua =
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
    expect(parseUserAgent(ua)).toEqual({
      browser: "chrome",
      platform: "windows",
      label: "Chrome on Windows",
    });
  });

  test("Edge on Windows", () => {
    const ua =
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0";
    expect(parseUserAgent(ua)).toEqual({
      browser: "edge",
      platform: "windows",
      label: "Edge on Windows",
    });
  });

  test("Firefox on Android", () => {
    const ua =
      "Mozilla/5.0 (Android 14; Mobile; rv:121.0) Gecko/121.0 Firefox/121.0";
    expect(parseUserAgent(ua)).toEqual({
      browser: "firefox",
      platform: "android",
      label: "Firefox on Android",
    });
  });
});
