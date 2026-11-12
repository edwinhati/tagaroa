import { describe, expect, test } from "bun:test";

import type { CarrierCredentials as NotificationProviders } from "../value-objects/carrier.vo";
import { channelStatus } from "./channel-status.service";

const providers = (
  overrides: Partial<NotificationProviders> = {},
): NotificationProviders => ({ ...overrides });

const resend = { apiKey: "k", from: "Tagaroa <no-reply@example.com>" };

describe("channelStatus", () => {
  test("names the carrier of every channel, configured or not", () => {
    expect(channelStatus(providers()).channels).toEqual([
      { channel: "email", configured: false, provider: "Resend" },
      { channel: "sms", configured: false, provider: "Twilio" },
      { channel: "whatsapp", configured: false, provider: "Meta" },
    ]);
  });

  test("a channel is configured only when its own credential is present", () => {
    const status = channelStatus(providers({ resend }));
    expect(
      status.channels
        .filter((channel) => channel.configured)
        .map((c) => c.channel),
    ).toEqual(["email"]);
  });

  test("carries whether anything actually leaves the building", () => {
    // Credentials decide it, not the environment: a deployment holding none
    // writes every message to the log, and one holding any really sends.
    expect(channelStatus(providers()).live).toBe(false);
    expect(channelStatus(providers({ resend })).live).toBe(true);
  });
});
