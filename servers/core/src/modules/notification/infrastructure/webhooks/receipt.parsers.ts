import { asObject } from "@repo/contracts";

import type { Receipt } from "../../domain/value-objects/delivery-receipt.vo";

/**
 * Three providers' payloads, translated into the one thing the domain knows.
 *
 * Infrastructure rather than domain: every shape here belongs to Resend, Twilio
 * or Meta and changes when they change it. What survives the translation — a
 * receipt, and whether it ends the destination's usefulness — is the part the
 * rest of the module reasons about.
 */
const asArray = (value: unknown): unknown[] =>
  Array.isArray(value) ? value : [];

const text = (value: unknown): string | null =>
  typeof value === "string" ? value : null;

/** Resend's event names, and which of them end the address's usefulness. */
const RESEND_OUTCOMES: Record<string, Pick<Receipt, "status" | "suppress">> = {
  "email.bounced": { status: "bounced", suppress: "bounced" },
  "email.complained": { status: "bounced", suppress: "complained" },
  "email.delivered": { status: "delivered", suppress: null },
  "email.delivery_delayed": { status: "sent", suppress: null },
  "email.sent": { status: "sent", suppress: null },
};

export const resendReceipts = (payload: unknown): Receipt[] => {
  const event = asObject(payload);
  const outcome = RESEND_OUTCOMES[text(event?.type) ?? ""];
  const data = asObject(event?.data);
  const providerId = text(data?.email_id);
  if (!outcome || !providerId) return [];

  const [to] = asArray(data?.to);
  return [{ ...outcome, destination: text(to), providerId }];
};

/** 21610 is Twilio's "this number sent STOP". */
const TWILIO_OPTED_OUT = "21610";

export const twilioReceipts = (
  params: Readonly<Record<string, string>>,
): Receipt[] => {
  const providerId = params.MessageSid ?? params.SmsSid;
  if (!providerId) return [];

  const status = params.MessageStatus ?? params.SmsStatus;
  const optedOut =
    params.ErrorCode === TWILIO_OPTED_OUT || params.OptOutType === "STOP";

  if (status === "delivered") {
    return [
      {
        destination: params.To ?? null,
        providerId,
        status: "delivered",
        suppress: null,
      },
    ];
  }
  if (status === "failed" || status === "undelivered") {
    return [
      {
        destination: params.To ?? null,
        providerId,
        status: "bounced",
        suppress: optedOut ? "opted-out" : null,
      },
    ];
  }
  return [];
};

/** Meta's code for a recipient who stopped the business messaging them. */
const META_OPTED_OUT = 131050;

export const metaReceipts = (payload: unknown): Receipt[] =>
  asArray(asObject(payload)?.entry).flatMap((entry) =>
    asArray(asObject(entry)?.changes).flatMap((change) =>
      asArray(asObject(asObject(change)?.value)?.statuses).flatMap(
        (raw): Receipt[] => {
          const update = asObject(raw);
          const providerId = text(update?.id);
          if (!providerId) return [];

          const destination = text(update?.recipient_id);
          const status = text(update?.status);
          if (status === "delivered" || status === "read") {
            return [
              { destination, providerId, status: "delivered", suppress: null },
            ];
          }
          if (status !== "failed") return [];

          const optedOut = asArray(update?.errors).some(
            (error) => asObject(error)?.code === META_OPTED_OUT,
          );
          return [
            {
              destination,
              providerId,
              status: "bounced",
              suppress: optedOut ? "opted-out" : "failed",
            },
          ];
        },
      ),
    ),
  );
