import { expect, test } from "bun:test";

import { ChannelError } from "../errors/channel.error";
import { nextAttemptDelaySeconds, outcomeFor } from "./retry-policy.vo";

test("backs off one minute, then doubles, then stops at an hour", () => {
  expect(nextAttemptDelaySeconds(1)).toBe(60);
  expect(nextAttemptDelaySeconds(2)).toBe(120);
  expect(nextAttemptDelaySeconds(3)).toBe(240);
  expect(nextAttemptDelaySeconds(20)).toBe(3600);
});

test("retries a provider outage until the attempts run out", () => {
  const outage = new ChannelError("Twilio refused the message (503)", false);

  expect(outcomeFor(outage, 1, 5)).toEqual({
    delaySeconds: 60,
    status: "pending",
  });
  expect(outcomeFor(outage, 5, 5)).toEqual({
    delaySeconds: null,
    status: "failed",
  });
});

test("does not retry a refusal that will be refused again", () => {
  const rejected = new ChannelError("WhatsApp refused the message (400)", true);

  expect(outcomeFor(rejected, 1, 5)).toEqual({
    delaySeconds: null,
    status: "failed",
  });
});

test("treats an unknown throw as worth retrying", () => {
  expect(outcomeFor(new Error("socket hang up"), 2, 5)).toEqual({
    delaySeconds: 120,
    status: "pending",
  });
});
