import { asObject } from "@repo/contracts";
import { renderEmail } from "@repo/email";

import type {
  ChannelResult,
  OutgoingMessage,
} from "../../domain/repositories/message-carrier.port";
import { deadline, failed } from "./http-failure";

export interface ResendConfig {
  apiKey: string;
  /** The verified sending identity, e.g. `Tagaroa <no-reply@example.com>`. */
  from: string;
}

export const resendSender =
  (config: ResendConfig) =>
  async (message: OutgoingMessage): Promise<ChannelResult> => {
    // Both parts, not one: `text` is the wording exactly as the template row
    // and the message log hold it, so a plain-text client — and anyone reading
    // the log beside the inbox — sees the same message the shell laid out.
    const html = await renderEmail({
      body: message.payload.body,
      subject: message.payload.subject,
    });

    const response = await fetch("https://api.resend.com/emails", {
      body: JSON.stringify({
        from: config.from,
        html,
        subject: message.payload.subject ?? "",
        text: message.payload.body,
        to: [message.destination],
      }),
      headers: {
        authorization: `Bearer ${config.apiKey}`,
        "content-type": "application/json",
        // A retry after a lost response is the same message, not a second
        // one: Resend drops a repeat of a key it has already accepted.
        "idempotency-key": message.id,
      },
      method: "POST",
      signal: deadline(),
    });
    if (!response.ok) await failed("Resend", response);

    const body = asObject(await response.json());
    return { providerId: typeof body?.id === "string" ? body.id : null };
  };
