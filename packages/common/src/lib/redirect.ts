export function resolveSafeRedirect(
  raw: string | null | undefined,
  dashboardBase: string,
): string {
  const base = dashboardBase || "/";

  const isAbsoluteBase = /^https?:\/\//i.test(base);

  const fallback = base.startsWith("/") || isAbsoluteBase ? base : "/";

  const allowedOrigins = new Set<string>();
  try {
    if (isAbsoluteBase) {
      allowedOrigins.add(new URL(base).origin);
    } else if (typeof window !== "undefined") {
      allowedOrigins.add(window.location.origin);
    }
  } catch {
    // ignore
  }

  const extra = process.env.NEXT_PUBLIC_ALLOWED_REDIRECT_ORIGINS;
  if (extra) {
    for (const part of extra.split(/[,\s]+/)) {
      const v = part.trim();
      if (!v) continue;
      try {
        allowedOrigins.add(new URL(v).origin);
      } catch {
        // ignore invalid values
      }
    }
  }

  if (!raw) return fallback;

  try {
    const blocked = [
      /^\/login(\/|$)/,
      /^\/forgot-password(\/|$)/,
      /^\/reset-password(\/|$)/,
    ];

    if (raw.startsWith("/") && !raw.startsWith("//")) {
      if (blocked.some((re) => re.test(raw))) return fallback;

      if (isAbsoluteBase) {
        return new URL(raw, base).toString();
      }

      return raw;
    }

    const target = new URL(raw);

    if (allowedOrigins.has(target.origin)) {
      if (isAbsoluteBase) {
        return target.toString();
      }
      return `${target.pathname}${target.search}${target.hash}` || "/";
    }

    const isDev = process.env.NODE_ENV !== "production";
    if (
      isDev &&
      (target.hostname === "localhost" || target.hostname === "127.0.0.1")
    ) {
      return target.toString();
    }

    return fallback;
  } catch {
    return fallback;
  }
}
