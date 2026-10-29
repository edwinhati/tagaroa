import { ChannelError } from "../errors/channel.error";

/** An hour between attempts is as far apart as they usefully get. */
const MAX_BACKOFF_SECONDS = 3600;

/** 1, 2, 4… minutes. */
export const nextAttemptDelaySeconds = (attempts: number): number =>
  Math.min(60 * 2 ** Math.max(0, attempts - 1), MAX_BACKOFF_SECONDS);

export interface DeliveryOutcome {
  status: "failed" | "pending";
  delaySeconds: number | null;
}

/**
 * What a failed send becomes. A permanent refusal — a malformed number, a
 * template Meta has not approved — fails immediately: every further attempt
 * would be refused identically, and on SMS and WhatsApp would be billed again.
 */
export const outcomeFor = (
  error: unknown,
  attempts: number,
  maxAttempts: number,
): DeliveryOutcome =>
  (error instanceof ChannelError && error.permanent) || attempts >= maxAttempts
    ? { delaySeconds: null, status: "failed" }
    : { delaySeconds: nextAttemptDelaySeconds(attempts), status: "pending" };
