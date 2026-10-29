import { asObject } from "@repo/contracts";

import type {
  ChannelResult,
  OutgoingMessage,
} from "../../domain/repositories/message-carrier.port";
import { deadline, failed } from "./http-failure";

export interface WhatsAppConfig {
  phoneNumberId: string;
  token: string;
  /** Graph API version. A knob because Meta retires versions on a schedule. */
  apiVersion: string;
}

export const whatsAppSender =
  (config: WhatsAppConfig) =>
  async (message: OutgoingMessage): Promise<ChannelResult> => {
    const response = await fetch(
      `https://graph.facebook.com/${config.apiVersion}/${config.phoneNumberId}/messages`,
      {
        body: JSON.stringify({
          messaging_product: "whatsapp",
          template: {
            // The body is the approved template's name, never free text: Meta
            // refuses anything else on a business-initiated message.
            components:
              message.payload.variables.length > 0
                ? [
                    {
                      parameters: message.payload.variables.map((text) => ({
                        text,
                        type: "text",
                      })),
                      type: "body",
                    },
                  ]
                : [],
            language: { code: message.locale },
            name: message.payload.body,
          },
          to: message.destination,
          type: "template",
        }),
        headers: {
          authorization: `Bearer ${config.token}`,
          "content-type": "application/json",
        },
        method: "POST",
        signal: deadline(),
      },
    );
    if (!response.ok) await failed("WhatsApp", response);

    const body = asObject(await response.json());
    const sent = Array.isArray(body?.messages)
      ? asObject(body.messages[0])
      : undefined;
    return { providerId: typeof sent?.id === "string" ? sent.id : null };
  };
