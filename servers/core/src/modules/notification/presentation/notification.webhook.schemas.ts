import * as z from "zod";

/**
 * The parts of each provider's payload the receipt parsers read. The payloads
 * are theirs, not ours: unknown keys are dropped rather than refused, and an
 * event the parsers ignore still passes, so the provider is not made to retry
 * it. What the parsers rely on must be there and be the right type.
 */
const NOT_AN_OBJECT = "Request body must be a JSON object.";

/** Resend (Svix). Every `email.*` event names the message it is about. */
export const resendEvent = z
  .object(
    {
      type: z.string({ error: "Send the event type." }),
      data: z.object(
        {
          email_id: z.string().min(1).optional(),
          to: z.array(z.string()).optional(),
        },
        { error: "Send the event data." },
      ),
    },
    { error: NOT_AN_OBJECT },
  )
  .refine(({ data, type }) => !type.startsWith("email.") || data.email_id, {
    message: "Send the email's id.",
    path: ["data", "email_id"],
  });

/** Twilio's status callback, already flattened to its form fields. */
const field = z.string().optional();
export const twilioStatusCallback = z
  .object({
    MessageSid: field,
    SmsSid: field,
    MessageStatus: field,
    SmsStatus: field,
    To: field,
    ErrorCode: field,
    OptOutType: field,
  })
  .refine(({ MessageSid, SmsSid }) => MessageSid || SmsSid, {
    message: "Send the message's sid.",
    path: ["MessageSid"],
  })
  .refine(({ MessageStatus, SmsStatus }) => MessageStatus || SmsStatus, {
    message: "Send the message's status.",
    path: ["MessageStatus"],
  });

/** Meta's WhatsApp notification. Only `statuses` become receipts. */
const metaStatus = z.object({
  id: z.string().min(1),
  status: z.string(),
  recipient_id: z.string().optional(),
  errors: z.array(z.object({ code: z.number() })).optional(),
});
export const metaNotification = z.object(
  {
    entry: z.array(
      z.object({
        changes: z.array(
          z.object({
            value: z.object({ statuses: z.array(metaStatus).optional() }),
          }),
        ),
      }),
    ),
  },
  { error: NOT_AN_OBJECT },
);
