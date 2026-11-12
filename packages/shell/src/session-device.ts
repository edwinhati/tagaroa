export type SessionBrowser = "chrome" | "safari" | "edge" | "firefox";
export type SessionPlatform = "apple" | "windows" | "android";

export type ParsedUserAgent = {
  browser: SessionBrowser | null;
  platform: SessionPlatform | null;
  /** Short label for the card, e.g. "Chrome on macOS". */
  label: string;
};

/**
 * Best-effort UA → browser/platform for session tiles.
 * Unknown agents stay null marks with a safe label.
 */
export function parseUserAgent(
  userAgent: string | null | undefined,
): ParsedUserAgent {
  const ua = (userAgent ?? "").trim();
  if (!ua) {
    return { browser: null, platform: null, label: "Unknown device" };
  }

  const browser = detectBrowser(ua);
  const platform = detectPlatform(ua);
  const browserName = browserNameOf(browser);
  const platformName = platformNameOf(ua, platform);

  const label =
    browserName && platformName
      ? `${browserName} on ${platformName}`
      : browserName || platformName || truncateUa(ua);

  return { browser, platform, label };
}

function detectBrowser(ua: string): SessionBrowser | null {
  if (/Edg\//i.test(ua)) return "edge";
  if (/Firefox\//i.test(ua) || /FxiOS\//i.test(ua)) return "firefox";
  if (/CriOS\//i.test(ua) || (/Chrome\//i.test(ua) && !/Edg\//i.test(ua))) {
    return "chrome";
  }
  if (/Safari\//i.test(ua) && !/Chrome\//i.test(ua) && !/CriOS\//i.test(ua)) {
    return "safari";
  }
  return null;
}

function detectPlatform(ua: string): SessionPlatform | null {
  if (/Android/i.test(ua)) return "android";
  if (/Windows/i.test(ua)) return "windows";
  if (/iPhone|iPad|iPod|Macintosh|Mac OS X/i.test(ua)) return "apple";
  return null;
}

function browserNameOf(browser: SessionBrowser | null): string | null {
  switch (browser) {
    case "chrome":
      return "Chrome";
    case "safari":
      return "Safari";
    case "edge":
      return "Edge";
    case "firefox":
      return "Firefox";
    default:
      return null;
  }
}

function platformNameOf(
  ua: string,
  platform: SessionPlatform | null,
): string | null {
  if (platform === "windows") return "Windows";
  if (platform === "android") return "Android";
  if (platform === "apple") {
    if (/iPhone/i.test(ua)) return "iPhone";
    if (/iPad/i.test(ua)) return "iPad";
    if (/Macintosh|Mac OS X/i.test(ua)) return "macOS";
    return "Apple";
  }
  return null;
}

function truncateUa(ua: string): string {
  return ua.length > 48 ? `${ua.slice(0, 45)}…` : ua;
}
