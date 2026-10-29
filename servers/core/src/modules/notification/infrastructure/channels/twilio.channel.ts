import { asObject } from "@repo/contracts";

import type {
  ChannelResult,
  OutgoingMessage,
} from "../../domain/repositories/message-carrier.port";
import { deadline, failed } from "./http-failure";

export interface TwilioConfig {
  accountSid: string;
  authToken: string;
  /** An SMS-capable number, or a messaging service SID. */
  from: string;
  /** Where Twilio posts delivery status; absent means no receipts. */
  statusCallback?: string;
}

export const twilioSender =
  (config: TwilioConfig) =>
  async (message: OutgoingMessage): Promise<ChannelResult> => {
    const form = new URLSearchParams({
      Body: message.payload.body,
      From: config.from,
      To: message.destination,
    });
    if (config.statusCallback)
      form.set("StatusCallback", config.statusCallback);

    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${config.accountSid}/Messages.json`,
      {
        body: form,
        headers: {
          authorization: `Basic ${Buffer.from(`${config.accountSid}:${config.authToken}`).toString("base64")}`,
          "content-type": "application/x-www-form-urlencoded",
        },
        method: "POST",
        signal: deadline(),
      },
    );
    if (!response.ok) await failed("Twilio", response);

    const body = asObject(await response.json());
    return { providerId: typeof body?.sid === "string" ? body.sid : null };
  };
