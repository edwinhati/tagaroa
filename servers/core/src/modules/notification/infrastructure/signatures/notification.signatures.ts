import { createHmac, timingSafeEqual } from "node:crypto";

/** Constant-time compare that tolerates a length mismatch. */
const matches = (expected: string, candidate: string): boolean => {
  const left = Buffer.from(expected);
  const right = Buffer.from(candidate);
  return left.length === right.length && timingSafeEqual(left, right);
};

/**
 * An HMAC under an empty key is one anyone can compute, so a check against an
 * empty secret proves nothing about the sender. Every verifier refuses one
 * rather than trusting each caller to have caught it.
 */
const usableKey = (key: string | Buffer): boolean => key.length > 0;

/** How far a webhook's own timestamp may be from ours before it is a replay. */
const TIMESTAMP_TOLERANCE_SECONDS = 5 * 60;

export interface SvixVerification {
  /** Resend's signing secret, `whsec_`-prefixed base64. */
  secret: string;
  id: string;
  timestamp: string;
  /** The `svix-signature` header: one or more space-separated `v1,<base64>`. */
  signature: string;
  /** The body exactly as received — re-serialising it changes the signature. */
  payload: string;
  now?: Date;
}

/**
 * Resend signs with Svix. The scheme is small enough to implement — an HMAC over
 * `id.timestamp.body` — which is cheaper than taking the `svix` dependency for
 * one route, and it keeps the check in the same file as the other two providers'.
 *
 * The timestamp is checked as well as the signature: without it a captured
 * request stays valid forever.
 */
export const verifySvixSignature = ({
  id,
  now = new Date(),
  payload,
  secret,
  signature,
  timestamp,
}: SvixVerification): boolean => {
  const seconds = Number(timestamp);
  if (!Number.isFinite(seconds)) return false;
  const drift = Math.abs(Math.floor(now.getTime() / 1000) - seconds);
  if (drift > TIMESTAMP_TOLERANCE_SECONDS) return false;

  // `whsec_` alone, the placeholder in `.env.example`, decodes to no key at all.
  const key = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  if (!usableKey(key)) return false;
  const expected = createHmac("sha256", key)
    .update(`${id}.${timestamp}.${payload}`)
    .digest("base64");

  // Svix sends every currently-valid key's signature, so any one may match.
  return signature
    .split(" ")
    .some((entry) => matches(expected, entry.split(",")[1] ?? ""));
};

export interface TwilioVerification {
  authToken: string;
  /** The public URL Twilio was configured with, query string included. */
  url: string;
  /** The form-encoded body's fields. */
  params: Readonly<Record<string, string>>;
  signature: string;
}

/**
 * Twilio signs the URL it called plus every form field, sorted by name and
 * concatenated. The URL must be the one Twilio holds, not one rebuilt from the
 * request: behind a proxy the host and scheme this service sees are not
 * necessarily the ones that were signed.
 */
export const verifyTwilioSignature = ({
  authToken,
  params,
  signature,
  url,
}: TwilioVerification): boolean => {
  if (!usableKey(authToken)) return false;
  const signed = Object.keys(params)
    .sort()
    .reduce((accumulator, name) => accumulator + name + params[name], url);

  return matches(
    createHmac("sha1", authToken).update(signed, "utf8").digest("base64"),
    signature,
  );
};

export interface MetaVerification {
  appSecret: string;
  /** The `x-hub-signature-256` header, `sha256=`-prefixed hex. */
  signature: string;
  payload: string;
}

/** Meta signs the raw body with the app secret. */
export const verifyMetaSignature = ({
  appSecret,
  payload,
  signature,
}: MetaVerification): boolean =>
  usableKey(appSecret) &&
  matches(
    `sha256=${createHmac("sha256", appSecret).update(payload, "utf8").digest("hex")}`,
    signature,
  );
