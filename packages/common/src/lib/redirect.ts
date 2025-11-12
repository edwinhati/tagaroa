const blockedPatterns = [
  /^\/login(\/|$)/,
  /^\/forgot-password(\/|$)/,
  /^\/reset-password(\/|$)/,
];

const localDevHosts = new Set(["localhost", "127.0.0.1"]);

export function resolveSafeRedirect(
  raw: string | null | undefined,
  dashboardBase: string,
): string {
  const base = dashboardBase || "/";
  const fallback = getFallback(base);
  const allowedOrigins = buildAllowedOrigins(base);

  if (!raw) return fallback;

  try {
    if (isRelativePath(raw)) {
      return resolveRelativePath(raw, base, fallback);
    }

    return resolveAbsoluteTarget(raw, allowedOrigins, fallback, base);
  } catch {
    return fallback;
  }
}

function getFallback(base: string) {
  return base.startsWith("/") || isAbsoluteUrl(base) ? base : "/";
}

function buildAllowedOrigins(base: string) {
  const origins = new Set<string>();
  addOriginIfValid(origins, isAbsoluteUrl(base) ? base : getWindowOrigin());
  addConfiguredOrigins(origins);
  return origins;
}

function getWindowOrigin() {
  return (globalThis as { location?: Location }).location?.origin ?? "";
}

function addOriginIfValid(origins: Set<string>, value?: string) {
  if (!value) return;
  try {
    origins.add(new URL(value).origin);
  } catch {
    // ignore invalid origins
  }
}

function addConfiguredOrigins(origins: Set<string>) {
  const extra = process.env.NEXT_PUBLIC_ALLOWED_REDIRECT_ORIGINS;
  if (!extra) return;
  for (const part of extra.split(/[,\s]+/)) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    addOriginIfValid(origins, trimmed);
  }
}

function isRelativePath(value: string) {
  return value.startsWith("/") && !value.startsWith("//");
}

function resolveRelativePath(
  raw: string,
  base: string,
  fallback: string,
): string {
  if (blockedPatterns.some((re) => re.test(raw))) {
    return fallback;
  }

  if (isAbsoluteUrl(base)) {
    return new URL(raw, base).toString();
  }

  return raw;
}

function resolveAbsoluteTarget(
  raw: string,
  allowedOrigins: Set<string>,
  fallback: string,
  base: string,
): string {
  const target = new URL(raw);

  if (allowedOrigins.has(target.origin)) {
    return isAbsoluteUrl(base)
      ? target.toString()
      : `${target.pathname}${target.search}${target.hash}` || "/";
  }

  if (isDevMode() && localDevHosts.has(target.hostname)) {
    return target.toString();
  }

  return fallback;
}

function isDevMode() {
  return process.env.NODE_ENV !== "production";
}

function isAbsoluteUrl(value: string) {
  return /^https?:\/\//i.test(value);
}
