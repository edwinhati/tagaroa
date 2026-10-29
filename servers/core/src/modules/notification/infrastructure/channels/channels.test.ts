import { afterEach, expect, spyOn, test } from "bun:test";

import type { OutgoingMessage } from "../../domain/repositories/message-carrier.port";
import { outcomeFor } from "../../domain/value-objects/retry-policy.vo";
import { resendSender } from "./resend.channel";
import { twilioSender } from "./twilio.channel";
import { whatsAppSender } from "./whatsapp.channel";

const message: OutgoingMessage = {
  channel: "email",
  destination: "ada@example.com",
  id: "msg_1",
  locale: "en",
  payload: { body: "Hello", subject: "Hi", variables: [] },
};

const senders = {
  Resend: resendSender({ apiKey: "re_key", from: "Tagaroa <no-reply@x.dev>" }),
  Twilio: twilioSender({ accountSid: "AC1", authToken: "t", from: "+1555" }),
  WhatsApp: whatsAppSender({
    apiVersion: "v21.0",
    phoneNumberId: "1",
    token: "t",
  }),
};

afterEach(() => {
  (globalThis.fetch as unknown as { mockRestore?: () => void }).mockRestore?.();
});

/** A provider that accepts the connection and then never answers. */
const stall = () =>
  spyOn(globalThis, "fetch").mockImplementation(
    ((_url: string, init?: RequestInit) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () =>
          reject(init.signal?.reason),
        );
      })) as unknown as typeof fetch,
  );

for (const [provider, send] of Object.entries(senders)) {
  test(`${provider} gives up on a stalled call, and the failure is retried`, async () => {
    // The deadline, run out as soon as the call is in flight.
    const timeout = spyOn(AbortSignal, "timeout").mockImplementation(() => {
      const controller = new AbortController();
      setTimeout(() =>
        controller.abort(new DOMException("timed out", "TimeoutError")),
      );
      return controller.signal;
    });
    stall();

    const error = await send(message).catch((caught: unknown) => caught);
    timeout.mockRestore();

    expect(error).toBeInstanceOf(DOMException);
    expect(outcomeFor(error, 1, 5).status).toBe("pending");
  });
}

test("Resend sends the message id as its idempotency key", async () => {
  const fetched = spyOn(globalThis, "fetch").mockResolvedValue(
    Response.json({ id: "re_1" }),
  );

  await expect(senders.Resend(message)).resolves.toEqual({
    providerId: "re_1",
  });

  const init = fetched.mock.calls[0]?.[1] as RequestInit;
  expect(new Headers(init.headers).get("idempotency-key")).toBe("msg_1");
});
