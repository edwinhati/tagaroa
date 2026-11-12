import { createHmac, timingSafeEqual } from "node:crypto";
import type { IncomingMessage } from "node:http";

/**
 * A provider's webhook as it reaches the handler: the parsed body, and the
 * undecoded bytes `AuthModule`'s `rawBody` keeps, which are what was signed.
 */
export interface SignedRequest extends IncomingMessage {
  body?: unknown;
  rawBody?: Buffer;
}

const constantTimeEquals = (expected: string, candidate: string): boolean => {
  const left = Buffer.from(expected);
  const right = Buffer.from(candidate);
  return left.length === right.length && timingSafeEqual(left, right);
};

/**
 * Whether `signature` is `prefix` plus the HMAC of `payload` under `key`,
 * compared in constant time. An HMAC under an empty key is one anyone can
 * compute, so an empty key never matches, whatever the caller checked.
 */
export const hmacMatches = ({
  algorithm,
  encoding,
  key,
  payload,
  prefix = "",
  signature,
}: {
  algorithm: "sha1" | "sha256";
  encoding: "base64" | "hex";
  key: string | Buffer;
  payload: string;
  prefix?: string;
  signature: string;
}): boolean =>
  key.length > 0 &&
  constantTimeEquals(
    prefix +
      createHmac(algorithm, key).update(payload, "utf8").digest(encoding),
    signature,
  );
