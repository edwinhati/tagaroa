/**
 * Reading values TypeScript cannot vouch for: request bodies, responses, and
 * errors that arrive across a boundary as `unknown`. Both ends of the workspace
 * — the core service and the apps — do this, so the narrowing lives once.
 */

export type ObjectLike = Record<string, unknown>;

/** The value as a plain object, or undefined when it is not one. */
export function asObject(value: unknown): ObjectLike | undefined {
  return typeof value === "object" && value !== null
    ? (value as ObjectLike)
    : undefined;
}

/**
 * The message the thrown value carries, when it has a useful one. Anything else
 * — a string, a bare object, a rejection with no message — gets the sentence the
 * caller owns.
 */
export function messageFor(error: unknown, fallback: string): string {
  const message = asObject(error)?.message;
  if (typeof message === "string" && message.length > 0) return message;
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}
