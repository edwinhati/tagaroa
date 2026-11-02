import * as z from "zod";

import { NOTIFICATION_CHANNELS } from "../domain/value-objects/notification-channel.vo";

const required = (field: string) =>
  z
    .string({ error: `${field} is required` })
    .trim()
    .min(1, `${field} is required`);

// Absent or null reads as an empty list, as it always has.
const names = (field: string) =>
  z
    .array(z.string({ error: `${field} must be a list of names` }), {
      error: `${field} must be a list of names`,
    })
    .nullish()
    .transform((value) => value ?? []);

/**
 * `POST /notifications/templates`: a draft's shape. Its rules — the key's
 * form, an email's subject, a WhatsApp body, secrets among the variables —
 * stay in `TemplateDraft`, which is what proves they ran.
 */
export const templateDraftBody = z.object(
  {
    // Key order is the order issues are reported in, as `TemplateDraft` checks.
    key: required("key"),
    channel: required("channel").pipe(
      z.enum(NOTIFICATION_CHANNELS, {
        error: `channel must be one of ${NOTIFICATION_CHANNELS.join(", ")}`,
      }),
    ),
    body: required("body"),
    variables: names("variables"),
    secrets: names("secrets"),
    locale: required("locale"),
    subject: z
      .string({ error: "subject must be text" })
      .nullish()
      .transform((value) => value ?? null),
  },
  { error: "A template is required" },
);

export type TemplateDraftBody = z.output<typeof templateDraftBody>;

const EXPECTED_UPDATED_AT = "expectedUpdatedAt must be a valid timestamp";

/** `PUT /notifications/templates/:id`: the draft, and the version it edits. */
export const editTemplateBody = templateDraftBody.extend({
  expectedUpdatedAt: z
    .string({ error: EXPECTED_UPDATED_AT })
    .refine((value) => Number.isFinite(Date.parse(value)), EXPECTED_UPDATED_AT)
    .transform((value) => new Date(value)),
});

export type EditTemplateBody = z.output<typeof editTemplateBody>;
