/**
 * The module's configuration, split along the four things that read it.
 *
 * It used to be one `NotificationOptions` bag injected into all four: the
 * webhook controller held the provider credentials it never sends with, the
 * admin controller held the poll interval, and every consumer's test had to
 * build the whole thing before it could assert on anything. A token per
 * consumer means a constructor states what it actually needs.
 */

export const WORDING_OPTIONS = Symbol("WORDING_OPTIONS");

export interface WordingOptions {
  /** Used when the caller names no locale, and as the fallback wording. */
  defaultLocale: string;
}

export const DISPATCH_OPTIONS = Symbol("DISPATCH_OPTIONS");

export interface DispatchOptions {
  /** How many messages the dispatcher claims at a time. */
  batchSize: number;
  /** Attempts before a message is given up on. */
  maxAttempts: number;
  /** How often the dispatcher looks for due messages. */
  pollMilliseconds: number;
  /** Whether this process drains the queue at all. */
  worker: boolean;
}

export const WEBHOOK_SECRETS = Symbol("WEBHOOK_SECRETS");

/**
 * What it takes to believe a provider's callback. Deliberately separate from
 * the credentials that send: a webhook route needs to verify, never to send,
 * and an absent secret is a failed check rather than a skipped one.
 */
export interface WebhookSecrets {
  /**
   * The public URL these routes are reachable at. Twilio signs the URL it was
   * configured with, which behind a proxy is not the one this service sees.
   */
  baseUrl: string;
  resendSecret?: string;
  metaAppSecret?: string;
  metaVerifyToken?: string;
  /** Twilio signs with the same token it authenticates with. */
  twilioAuthToken?: string;
}

/**
 * Where a provider posts its receipts: `notifications/webhooks/:provider` under
 * the public base URL. Twilio is told this URL when a message is sent and signs
 * it, so the sender and the signature check must build the same one.
 */
export const webhookUrl = (
  baseUrl: string,
  provider: "meta" | "resend" | "twilio",
) => `${baseUrl}/${provider}`;
