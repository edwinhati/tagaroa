const BASE32 = /^[A-Z2-7]+$/;

/** The manual key encoded in a Better Auth TOTP enrollment URI. */
export function setupKeyFromTotpUri(uri: string): string | null {
  try {
    const parsed = new URL(uri);
    if (parsed.protocol !== "otpauth:") return null;
    const secret = (parsed.searchParams.get("secret") ?? "")
      .replace(/=+$/, "")
      .replaceAll(" ", "")
      .toUpperCase();
    return secret && BASE32.test(secret) ? secret : null;
  } catch {
    return null;
  }
}

/** Groups a long setup key so it can be read and transcribed safely. */
export const formatSetupKey = (key: string): string =>
  key.match(/.{1,4}/g)?.join(" ") ?? key;
